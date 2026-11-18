mod commands;

use commands::system::{get_app_status, get_system_info, ping};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_app_status,
            ping
        ])
        .run(tauri::generate_context!())
        .expect("error while running Desktop Intelligence Assistant");
}
