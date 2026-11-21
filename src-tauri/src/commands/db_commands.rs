//! Tauri IPC commands for all database and news operations.
//!
//! Each command acquires the `DbState` mutex, delegates to the repository layer,
//! and releases the lock before returning.  Async commands (such as feed synchronization)
//! do not hold locks during network operations, ensuring the UI is never blocked.

use tauri::State;

use crate::db::{
    repository::{
        add_news_source, delete_news_source, delete_setting, get_all_settings, get_articles,
        get_articles_paginated, get_briefings_by_category, get_category_preferences, get_db_stats,
        get_latest_briefings, get_news_sources, get_setting, insert_articles, prune_old_articles,
        set_news_source_enabled, upsert_briefing, upsert_category_preference, upsert_setting,
        Article, Briefing, CategoryPreference, DbSetting, NewArticle, NewBriefing, NewsSource,
    },
    DbState,
};
use crate::news::SyncReport;

// ─────────────────────────────────────────────────────────────────────────────
// Settings Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_setting(
    state: State<'_, DbState>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_setting(&conn, &key)
}

#[tauri::command]
pub fn db_upsert_setting(
    state: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    upsert_setting(&conn, &key, &value)
}

#[tauri::command]
pub fn db_delete_setting(
    state: State<'_, DbState>,
    key: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    delete_setting(&conn, &key)
}

#[tauri::command]
pub fn db_get_all_settings(
    state: State<'_, DbState>,
) -> Result<Vec<DbSetting>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_all_settings(&conn)
}

// ─────────────────────────────────────────────────────────────────────────────
// News Source Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_news_sources(
    state: State<'_, DbState>,
    category: Option<String>,
) -> Result<Vec<NewsSource>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_news_sources(&conn, category.as_deref())
}

#[tauri::command]
pub fn db_set_news_source_enabled(
    state: State<'_, DbState>,
    source_id: i64,
    enabled: bool,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    set_news_source_enabled(&conn, source_id, enabled)
}

#[tauri::command]
pub fn db_add_news_source(
    state: State<'_, DbState>,
    name: String,
    url: String,
    category: String,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    add_news_source(&conn, &name, &url, &category)
}

#[tauri::command]
pub fn db_delete_news_source(
    state: State<'_, DbState>,
    source_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    delete_news_source(&conn, source_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed Synchronization
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn db_sync_news_feeds(
    state: State<'_, DbState>,
) -> Result<SyncReport, String> {
    crate::news::sync_all_feeds(&state).await
}

// ─────────────────────────────────────────────────────────────────────────────
// Article Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_insert_articles(
    state: State<'_, DbState>,
    articles: Vec<NewArticle>,
) -> Result<u64, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    insert_articles(&conn, &articles)
}

#[tauri::command]
pub fn db_get_articles(
    state: State<'_, DbState>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<Article>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_articles(&conn, category.as_deref(), limit.unwrap_or(50))
}

#[tauri::command]
pub fn db_get_articles_paginated(
    state: State<'_, DbState>,
    category: Option<String>,
    search: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Article>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_articles_paginated(
        &conn,
        category.as_deref(),
        search.as_deref(),
        limit.unwrap_or(30),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
pub fn db_prune_old_articles(
    state: State<'_, DbState>,
    days: Option<u32>,
) -> Result<u64, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    prune_old_articles(&conn, days.unwrap_or(30))
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_upsert_briefing(
    state: State<'_, DbState>,
    briefing: NewBriefing,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    upsert_briefing(&conn, &briefing)
}

#[tauri::command]
pub fn db_get_latest_briefings(
    state: State<'_, DbState>,
) -> Result<Vec<Briefing>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_latest_briefings(&conn)
}

#[tauri::command]
pub fn db_get_briefings_by_category(
    state: State<'_, DbState>,
    category: String,
    limit: Option<u32>,
) -> Result<Vec<Briefing>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_briefings_by_category(&conn, &category, limit.unwrap_or(10))
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Preference Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_category_preferences(
    state: State<'_, DbState>,
) -> Result<Vec<CategoryPreference>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_category_preferences(&conn)
}

#[tauri::command]
pub fn db_upsert_category_preference(
    state: State<'_, DbState>,
    category: String,
    enabled: bool,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    upsert_category_preference(&conn, &category, enabled)
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic Command
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_stats(
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_db_stats(&conn)
}
