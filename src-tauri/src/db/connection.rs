//! Database connection management.
//!
//! Wraps a `rusqlite::Connection` behind a `Mutex` so Tauri can share it
//! safely across async command invocations via its managed-state system.

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

use crate::db::migrations::run_migrations;

/// Managed state type held by the Tauri app.
pub struct DbState(pub Mutex<Connection>);

/// Resolves the database file path.
/// Priority: "D:\extra file\database\nexora.db"
/// Fallback: "%APPDATA%\com.nexora.app\nexora.db" if the custom path cannot be accessed.
pub fn resolve_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let custom_dir = PathBuf::from(r"D:\extra file\database");

    if custom_dir.exists() || std::fs::create_dir_all(&custom_dir).is_ok() {
        return Ok(custom_dir.join("nexora.db"));
    }

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {e}"))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_dir.join("nexora.db"))
}

/// Opens (or creates) the SQLite database, runs all pending migrations,
/// and returns the initialised `DbState` ready to be registered with Tauri.
///
/// # Errors
/// Returns an error message string if the directory cannot be
/// determined, the file cannot be opened, or migrations fail.
pub fn init_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    let db_path = resolve_db_path(app)?;

    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory {}: {e}", parent.display()))?;
        }
    }

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
