mod commands;

use commands::system::{
    get_app_status, get_system_info, get_window_geometry, hide_window, is_shortcut_registered,
    ping, position_window_top_center, register_shortcut, set_island_geometry, show_window,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Toggle the main Nexora window: show + focus if hidden or unfocused, hide if visible and focused.
fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_focused = window.is_focused().unwrap_or(false);

        if is_visible && is_focused {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
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
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // ── Setup (shortcut + tray + initial geometry) ────────────────────────
        .setup(|app| {
            // Position the Dynamic Island at the top-center of the screen
            if let Some(window) = app.get_webview_window("main") {
                let _ = position_window_top_center(&window, 360.0, 48.0, 12.0);
            }

            // 1. Register Alt+Space global shortcut (avoiding duplicate registrations)
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
            if app.global_shortcut().is_registered(shortcut) {
                let _ = app.global_shortcut().unregister(shortcut);
            }

            if let Err(err) = app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                // Only fire on key-press (not release) to avoid double-toggle
                if event.state() == ShortcutState::Pressed {
                    toggle_window(app);
                }
            }) {
                eprintln!("[Nexora] Warning: Failed to register global shortcut Alt+Space: {err}");
            }

            // 2. Build system-tray menu
            let open_item =
                MenuItem::with_id(app, "open", "Open Nexora", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Exit Nexora", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open_item, &settings_item, &separator, &quit_item])?;

            // 3. Build tray icon
            TrayIconBuilder::new()
                .tooltip("Nexora Dynamic Island — Alt+Space")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false) // left-click toggles window; right-click shows menu
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "settings" => {
                        // Open settings view in the main window
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
                    // Left-click on tray icon → toggle window
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

            Ok(())
        })
        // ── Window events ─────────────────────────────────────────────────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide instead of close — keep the app alive in the tray
                let _ = window.hide();
                api.prevent_close();
            }
        })
        // ── IPC commands ──────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_app_status,
            ping,
            hide_window,
            show_window,
            get_window_geometry,
            set_island_geometry,
            register_shortcut,
            is_shortcut_registered
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nexora application");
}
