mod ai;
mod commands;
mod db;
mod news;

use commands::db_commands::{
    ai_ask_question, ai_generate_briefing, ai_get_briefings, ai_get_config, ai_get_stories,
    ai_process_news, ai_save_config, ai_test_connection, db_add_news_source, db_delete_news_source,
    db_delete_setting, db_get_all_settings, db_get_articles, db_get_articles_paginated,
    db_get_briefings_by_category, db_get_category_preferences, db_get_latest_briefings,
    db_get_news_sources, db_get_publishers, db_get_setting, db_get_stats, db_insert_articles, db_prune_old_articles,
    db_set_news_source_enabled, db_sync_news_feeds, db_upsert_briefing,
    db_upsert_category_preference, db_upsert_setting,
};
use commands::system::{
    get_app_status, get_preferences, get_system_info, get_window_geometry, hide_window,
    is_shortcut_registered, load_preferences_internal, ping, position_window_top_center,
    register_shortcut, save_preferences, set_island_geometry, set_launch_at_startup, show_window,
    update_global_shortcut,
};
use db::connection::init_db;
use std::str::FromStr;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Show the island in the user's chosen default mode.
fn open_island(app: &tauri::AppHandle) {
    let prefs = load_preferences_internal(app);
    let mode = if prefs.default_island_mode == "expanded" {
        "expanded"
    } else {
        "collapsed"
    };

    if let Some(window) = app.get_webview_window("main") {
        let (width, height) = if mode == "expanded" {
            (680.0, 520.0)
        } else {
            (360.0, 48.0)
        };
        let _ = position_window_top_center(&window, width, height, 12.0);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("open-island", mode);
    }
}

/// Toggle the main Orbit window: hide it when focused, otherwise open in the configured mode.
fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_focused = window.is_focused().unwrap_or(false);

        if is_visible && is_focused {
            let _ = window.hide();
        } else {
            open_island(app);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Plugins ───────────────────────────────────────────────────────────
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            open_island(app);
        }))
        // ── Setup (shortcut + tray + initial geometry + preferences + DB) ─────
        .setup(|app| {
            // ── 1. Initialise SQLite database ─────────────────────────────────
            let db_state = init_db(app.handle())
                .unwrap_or_else(|e| {
                    eprintln!("[Orbit DB] FATAL: Could not initialise database: {e}");
                    panic!("Database initialisation failed: {e}");
                });
            app.manage(db_state);

            // ── 2. Load user preferences from JSON (existing persistence) ─────
            let prefs = load_preferences_internal(app.handle());

            // ── 3. Position the Dynamic Island at the top-center ──────────────
            if let Some(window) = app.get_webview_window("main") {
                let (width, height) = match prefs.default_island_mode.as_str() {
                    "expanded" => (680.0, 520.0),
                    _ => (360.0, 48.0),
                };
                let _ = position_window_top_center(&window, width, height, 12.0);
                if !prefs.start_minimized {
                    let _ = window.show();
                } else {
                    let _ = window.hide();
                }
            }

            // ── 4. Register global shortcut from saved preferences ─────────────
            let shortcut_str = prefs.global_shortcut.replace(' ', "");
            let shortcut = Shortcut::from_str(&shortcut_str)
                .unwrap_or_else(|_| Shortcut::new(Some(Modifiers::ALT), Code::Space));

            if app.global_shortcut().is_registered(shortcut) {
                let _ = app.global_shortcut().unregister(shortcut);
            }

            if let Err(err) = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    toggle_window(app);
                }
            }) {
                eprintln!("[Orbit] Warning: Failed to register global shortcut '{}': {err}", shortcut_str);
            }

            // ── 5. Build system-tray menu ──────────────────────────────────────
            let open_item =
                MenuItem::with_id(app, "open", "Open Orbit", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Exit Orbit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_item, &settings_item, &separator, &quit_item])?;

            // ── 6. Build tray icon ─────────────────────────────────────────────
            TrayIconBuilder::new()
                .tooltip("Orbit Dynamic Island — Alt+Space")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        open_island(app);
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("open-settings", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(&tray.app_handle());
                    }
                })
                .build(app)?;

            // ── 7. Background News Sync Worker ─────────────────────────────────
            let bg_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Initial fetch delayed by 2s so window displays instantly without latency
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                if let Some(db_state) = bg_app.try_state::<crate::db::DbState>() {
                    let _ = crate::news::sync_all_feeds(&db_state).await;
                }

                // Periodic refresh loop (every 30 minutes = 1800s)
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(1800));
                loop {
                    interval.tick().await;
                    if let Some(db_state) = bg_app.try_state::<crate::db::DbState>() {
                        let _ = crate::news::sync_all_feeds(&db_state).await;
                    }
                }
            });

            Ok(())
        })
        // ── Window events ─────────────────────────────────────────────────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let prefs = load_preferences_internal(window.app_handle());
                match prefs.close_behavior.as_str() {
                    "exit" => {
                        window.app_handle().exit(0);
                    }
                    "minimize" => {
                        let _ = window.minimize();
                        api.prevent_close();
                    }
                    _ => {
                        // Default: hide to system tray
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
            }
        })
        // ── IPC commands ──────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // System / window commands (existing)
            get_system_info,
            get_app_status,
            ping,
            hide_window,
            show_window,
            get_window_geometry,
            set_island_geometry,
            register_shortcut,
            is_shortcut_registered,
            get_preferences,
            save_preferences,
            set_launch_at_startup,
            update_global_shortcut,
            // Database commands (existing & news engine)
            db_get_setting,
            db_upsert_setting,
            db_delete_setting,
            db_get_all_settings,
            db_get_news_sources,
            db_set_news_source_enabled,
            db_add_news_source,
            db_delete_news_source,
            db_sync_news_feeds,
            db_insert_articles,
            db_get_articles,
            db_get_articles_paginated,
            db_get_publishers,
            db_prune_old_articles,
            db_upsert_briefing,
            db_get_latest_briefings,
            db_get_briefings_by_category,
            db_get_category_preferences,
            db_upsert_category_preference,
            db_get_stats,
            // AI Intelligence commands
            ai_get_config,
            ai_save_config,
            ai_test_connection,
            ai_process_news,
            ai_get_stories,
            ai_generate_briefing,
            ai_get_briefings,
            ai_ask_question,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Orbit application");
}
