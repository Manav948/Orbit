use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{LogicalPosition, LogicalSize, Position, Size};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub app_version: String,
    pub tauri_version: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStatus {
    pub initialized: bool,
    pub runtime_mode: String,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowGeometry {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

/// Helper function to position any webview window at the top-center of the active/primary monitor.
pub fn position_window_top_center(
    window: &tauri::WebviewWindow,
    width: f64,
    height: f64,
    top_offset: f64,
) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| format!("Failed to get current monitor: {}", e))?
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(m) = monitor {
        let screen_pos = m.position();
        let screen_size = m.size();
        let scale_factor = m.scale_factor();

        let mon_x = screen_pos.x as f64 / scale_factor;
        let mon_y = screen_pos.y as f64 / scale_factor;
        let mon_width = screen_size.width as f64 / scale_factor;

        let target_x = mon_x + (mon_width - width) / 2.0;
        let target_y = mon_y + top_offset;

        window
            .set_size(Size::Logical(LogicalSize::new(width, height)))
            .map_err(|e| format!("Failed to set window size: {}", e))?;

        window
            .set_position(Position::Logical(LogicalPosition::new(target_x, target_y)))
            .map_err(|e| format!("Failed to set window position: {}", e))?;
    } else {
        window
            .set_size(Size::Logical(LogicalSize::new(width, height)))
            .map_err(|e| format!("Failed to set window size: {}", e))?;
    }

    Ok(())
}

/// Dynamically updates the native window size and position for Dynamic Island states:
/// - "collapsed": 360 × 48 px at top-center
/// - "expanded": 680 × 520 px at top-center
/// - "settings": 780 × 560 px at top-center
#[tauri::command]
pub fn set_island_geometry(window: tauri::WebviewWindow, state: String) -> Result<(), String> {
    let (width, height, top_offset) = match state.as_str() {
        "collapsed" => (360.0, 48.0, 12.0),
        "expanded" => (680.0, 520.0, 12.0),
        "settings" => (780.0, 560.0, 20.0),
        _ => (360.0, 48.0, 12.0),
    };

    position_window_top_center(&window, width, height, top_offset)
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        status: "Operational".to_string(),
    })
}

#[tauri::command]
pub fn get_app_status() -> Result<AppStatus, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to retrieve system clock: {}", e))?
        .as_millis() as u64;

    let runtime_mode = if cfg!(debug_assertions) {
        "Development"
    } else {
        "Production"
    };

    Ok(AppStatus {
        initialized: true,
        runtime_mode: runtime_mode.to_string(),
        timestamp_ms: now,
    })
}

#[tauri::command]
pub fn ping(message: String) -> Result<String, String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Payload cannot be empty. Please provide a message to send to the native desktop host.".to_string());
    }
    Ok(format!("Desktop Host acknowledged: '{}'", trimmed))
}

#[tauri::command]
pub fn hide_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| format!("Failed to hide window: {}", e))
}

#[tauri::command]
pub fn show_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| format!("Failed to show window: {}", e))?;
    window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_window_geometry(window: tauri::Window) -> Result<WindowGeometry, String> {
    let size = window.outer_size().map_err(|e| format!("Failed to get window size: {}", e))?;
    let pos = window.outer_position().map_err(|e| format!("Failed to get window position: {}", e))?;
    let scale = window.scale_factor().map_err(|e| format!("Failed to get scale factor: {}", e))?;
    Ok(WindowGeometry {
        width: size.width,
        height: size.height,
        x: pos.x,
        y: pos.y,
        scale_factor: scale,
    })
}

/// Dynamically registers a custom global shortcut string (e.g. "Alt+Space" or "Super+Shift+N").
#[tauri::command]
pub fn register_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<(), String> {
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
    use tauri::Manager;

    let shortcut = Shortcut::from_str(&shortcut_str)
        .map_err(|e| format!("Invalid shortcut string '{}': {:?}", shortcut_str, e))?;

    if app.global_shortcut().is_registered(shortcut) {
        let _ = app.global_shortcut().unregister(shortcut);
    }

    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
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
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;

    Ok(())
}

/// Queries whether a given shortcut is currently registered.
#[tauri::command]
pub fn is_shortcut_registered(app: tauri::AppHandle, shortcut_str: String) -> Result<bool, String> {
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let shortcut = Shortcut::from_str(&shortcut_str)
        .map_err(|e| format!("Invalid shortcut string '{}': {:?}", shortcut_str, e))?;

    Ok(app.global_shortcut().is_registered(shortcut))
}



