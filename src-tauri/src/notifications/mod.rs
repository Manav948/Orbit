//! Desktop Notification Manager.
//!
//! Handles Windows desktop notifications with user preferences, quiet hours checking,
//! duplicate prevention, and notification audit logging.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

use crate::db::repository::{can_send_notification, log_notification};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub enabled: bool,
    pub breaking: bool,
    pub briefings: bool,
    pub finance: bool,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
}

pub fn get_notification_preferences(conn: &Connection) -> NotificationPreferences {
    let enabled = crate::db::repository::get_setting(conn, "notifications_enabled")
        .unwrap_or(Some("true".to_string()))
        .unwrap_or_else(|| "true".to_string())
        == "true";

    let breaking = crate::db::repository::get_setting(conn, "notifications_breaking")
        .unwrap_or(Some("true".to_string()))
        .unwrap_or_else(|| "true".to_string())
        == "true";

    let briefings = crate::db::repository::get_setting(conn, "notifications_briefings")
        .unwrap_or(Some("true".to_string()))
        .unwrap_or_else(|| "true".to_string())
        == "true";

    let finance = crate::db::repository::get_setting(conn, "notifications_finance")
        .unwrap_or(Some("false".to_string()))
        .unwrap_or_else(|| "false".to_string())
        == "true";

    let quiet_hours_enabled = crate::db::repository::get_setting(conn, "quiet_hours_enabled")
        .unwrap_or(Some("false".to_string()))
        .unwrap_or_else(|| "false".to_string())
        == "true";

    let quiet_hours_start = crate::db::repository::get_setting(conn, "quiet_hours_start")
        .unwrap_or(Some("22:00".to_string()))
        .unwrap_or_else(|| "22:00".to_string());

    let quiet_hours_end = crate::db::repository::get_setting(conn, "quiet_hours_end")
        .unwrap_or(Some("08:00".to_string()))
        .unwrap_or_else(|| "08:00".to_string());

    NotificationPreferences {
        enabled,
        breaking,
        briefings,
        finance,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
    }
}

pub fn save_notification_preferences(
    conn: &Connection,
    prefs: &NotificationPreferences,
) -> Result<(), String> {
    crate::db::repository::upsert_setting(conn, "notifications_enabled", if prefs.enabled { "true" } else { "false" })?;
    crate::db::repository::upsert_setting(conn, "notifications_breaking", if prefs.breaking { "true" } else { "false" })?;
    crate::db::repository::upsert_setting(conn, "notifications_briefings", if prefs.briefings { "true" } else { "false" })?;
    crate::db::repository::upsert_setting(conn, "notifications_finance", if prefs.finance { "true" } else { "false" })?;
    crate::db::repository::upsert_setting(conn, "quiet_hours_enabled", if prefs.quiet_hours_enabled { "true" } else { "false" })?;
    crate::db::repository::upsert_setting(conn, "quiet_hours_start", &prefs.quiet_hours_start)?;
    crate::db::repository::upsert_setting(conn, "quiet_hours_end", &prefs.quiet_hours_end)?;
    Ok(())
}

/// Send a desktop notification if user preferences, quiet hours, and duplicate rules allow.
pub fn dispatch_notification(
    app: &AppHandle,
    conn: &Connection,
    title: &str,
    body: &str,
    topic: &str,
    force: bool,
) -> Result<bool, String> {
    if !force {
        let allowed = can_send_notification(conn, topic, title, 900)?;
        if !allowed {
            return Ok(false);
        }
    }

    // Dispatch via Tauri notification plugin to Windows Action Center
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();

    // Emit event to frontend for in-app alert banner
    let _ = app.emit("desktop-notification", serde_json::json!({
        "title": title,
        "body": body,
        "topic": topic
    }));

    // Record audit in SQLite
    let _ = log_notification(conn, topic, title, body);

    Ok(true)
}

