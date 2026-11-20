//! Database connection management.
//!
//! Wraps a `rusqlite::Connection` behind a `Mutex` so Tauri can share it
//! safely across async command invocations via its managed-state system.

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

use crate::db::migrations::run_migrations;

/// Managed state type held by the Tauri app.
pub struct DbState(pub Mutex<Connection>);

/// Opens (or creates) the SQLite database, runs all pending migrations,
/// and returns the initialised `DbState` ready to be registered with Tauri.
///
/// # Errors
/// Returns an error message string if the app-data directory cannot be
/// determined, the file cannot be opened, or migrations fail.
pub fn init_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    // Resolve %APPDATA%\com.nexora.app\  (or platform equivalent)
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {e}"))?;

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    let db_path = data_dir.join("nexora.db");

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open SQLite database at {}: {e}", db_path.display()))?;

    // Performance tuning: WAL journal for concurrent reads and faster writes
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous   = NORMAL;
         PRAGMA foreign_keys  = ON;
         PRAGMA temp_store    = MEMORY;",
    )
    .map_err(|e| format!("Failed to set SQLite PRAGMA options: {e}"))?;

    // Run schema migrations before returning the connection
    run_migrations(&conn)?;

    eprintln!("[Nexora DB] Database ready at: {}", db_path.display());

    Ok(DbState(Mutex::new(conn)))
}

