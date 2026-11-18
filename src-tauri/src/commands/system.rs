use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

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

