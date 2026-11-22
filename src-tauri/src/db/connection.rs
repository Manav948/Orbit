//! Database connection management.
//!
//! Wraps a `rusqlite::Connection` behind a `Mutex` so Tauri can share it
//! safely across async command invocations via its managed-state system.
//! Includes automatic corruption recovery and high-performance PRAGMA tuning.

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
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

/// Configure high-performance SQLite PRAGMAs.
pub fn configure_pragmas(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous   = NORMAL;
         PRAGMA foreign_keys  = ON;
         PRAGMA temp_store    = MEMORY;
         PRAGMA cache_size    = -64000;
         PRAGMA mmap_size     = 268435456;
         PRAGMA busy_timeout  = 5000;",
    )
    .map_err(|e| format!("Failed to set SQLite PRAGMA options: {e}"))?;
    Ok(())
}

/// Checks database integrity. Returns true if healthy, false if corrupted.
fn check_integrity(conn: &Connection) -> bool {
    let check: Result<String, _> = conn.query_row("PRAGMA quick_check", [], |r| r.get(0));
    matches!(check, Ok(ref s) if s == "ok")
}

/// Opens (or creates) the SQLite database, checks integrity, handles corrupted files,
/// runs all pending migrations, and returns the initialised `DbState`.
pub fn init_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    let db_path = resolve_db_path(app)?;

    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory {}: {e}", parent.display()))?;
        }
    }

    // Attempt to open and verify the existing database
    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open SQLite database at {}: {e}", db_path.display()))?;

    // If file existed, verify integrity; if corrupted, quarantine and recreate
    if !check_integrity(&conn) {
        eprintln!("[Nexora DB] WARNING: Database corruption detected at {}. Quarantining...", db_path.display());
        drop(conn);

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let quarantine_path = db_path.with_extension(format!("corrupted.{timestamp}.db"));
        let _ = std::fs::rename(&db_path, &quarantine_path);

        // Re-open clean database file
        conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to recreate SQLite database at {}: {e}", db_path.display()))?;
    }

    // Apply high-performance settings
    configure_pragmas(&conn)?;

    // Run schema migrations before returning the connection
    run_migrations(&conn)?;

    eprintln!("[Nexora DB] Database verified and ready at: {}", db_path.display());

    Ok(DbState(Mutex::new(conn)))
}
