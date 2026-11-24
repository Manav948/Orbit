//! Tauri IPC commands for all database and news operations.
//!
//! Each command acquires the `DbState` mutex, delegates to the repository layer,
//! and releases the lock before returning.  Async commands (such as feed synchronization)
//! do not hold locks during network operations, ensuring the UI is never blocked.

use tauri::State;

use crate::db::{
    repository::{
        add_news_source, backup_database, clear_temporary_cache, delete_news_source,
        delete_setting, get_all_settings, get_articles, get_articles_paginated,
        get_briefings_by_category, get_category_preferences, get_db_stats, get_latest_briefings,
        get_news_sources, get_setting, get_storage_breakdown, insert_articles, prune_old_articles,
        restore_database, set_news_source_enabled, upsert_briefing, upsert_category_preference,
        upsert_setting, Article, Briefing, CategoryPreference, CleanupResult, DbSetting,
        NewArticle, NewBriefing, NewsSource, StorageBreakdown,
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
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<SyncReport, String> {
    let report = crate::news::sync_all_feeds(&state).await?;

    // If new articles were fetched, automatically trigger AI story clustering
    // in the background (with cooldown) so AI Stories stays fresh without manual intervention.
    crate::news::maybe_trigger_ai_processing(report.new_articles, app);

    Ok(report)
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
    publisher: Option<String>,
    search: Option<String>,
    sort_by: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Article>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_articles_paginated(
        &conn,
        category.as_deref(),
        publisher.as_deref(),
        search.as_deref(),
        sort_by.as_deref(),
        limit.unwrap_or(30),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
pub fn db_get_publishers(
    state: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::db::repository::get_publishers(&conn)
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

// ─────────────────────────────────────────────────────────────────────────────
// AI Intelligence Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn ai_get_config(
    state: State<'_, DbState>,
) -> Result<crate::ai::AiConfigInfo, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    Ok(crate::ai::get_ai_config_info(&conn))
}

#[tauri::command]
pub fn ai_get_providers_config(
    state: State<'_, DbState>,
) -> Result<crate::ai::MultiAiConfigInfo, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    Ok(crate::ai::get_multi_ai_config_info(&conn))
}

#[tauri::command]
pub fn ai_save_provider_config(
    state: State<'_, DbState>,
    active_provider: Option<String>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    explanation_mode: Option<String>,
    briefing_length: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;

    if let Some(act) = active_provider {
        let trimmed = act.trim().to_lowercase();
        if !trimmed.is_empty() {
            crate::db::repository::upsert_setting(&conn, "active_ai_provider", &trimmed)?;
        }
    }

    let target_prov = provider
        .as_deref()
        .map(crate::ai::AiProvider::from_str_name)
        .unwrap_or_else(|| crate::ai::client::get_active_provider(&conn));

    if let Some(key) = api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() && !trimmed.contains('•') {
            crate::db::repository::upsert_setting(&conn, target_prov.key_setting_name(), trimmed)?;
        }
    }

    if let Some(mdl) = model {
        let trimmed = mdl.trim();
        if !trimmed.is_empty() {
            crate::db::repository::upsert_setting(&conn, target_prov.model_setting_name(), trimmed)?;
        }
    }

    if let Some(mode) = explanation_mode {
        crate::db::repository::upsert_setting(&conn, "ai_explanation_mode", mode.trim())?;
    }
    if let Some(len) = briefing_length {
        crate::db::repository::upsert_setting(&conn, "briefing_length", len.trim())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn ai_test_provider_connection(
    state: State<'_, DbState>,
    provider: Option<String>,
) -> Result<String, String> {
    crate::ai::test_provider_connection(&state, provider.as_deref()).await
}

#[tauri::command]
pub fn ai_save_config(
    state: State<'_, DbState>,
    api_key: Option<String>,
    model: Option<String>,
    explanation_mode: Option<String>,
    briefing_length: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    if let Some(key) = api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() && !trimmed.contains('•') {
            crate::db::repository::upsert_setting(&conn, "openai_api_key", trimmed)?;
        }
    }
    if let Some(mdl) = model {
        crate::db::repository::upsert_setting(&conn, "openai_model", mdl.trim())?;
    }
    if let Some(mode) = explanation_mode {
        crate::db::repository::upsert_setting(&conn, "ai_explanation_mode", mode.trim())?;
    }
    if let Some(len) = briefing_length {
        crate::db::repository::upsert_setting(&conn, "briefing_length", len.trim())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_test_connection(
    state: State<'_, DbState>,
) -> Result<String, String> {
    crate::ai::test_ai_connection(&state).await
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversational Assistant Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn assistant_send_message(
    state: State<'_, DbState>,
    conversation_id: Option<i64>,
    message: String,
) -> Result<crate::ai::engine::AssistantReply, String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Message cannot be empty".to_string());
    }
    if trimmed.len() > 10000 {
        return Err("Message exceeds maximum length of 10,000 characters".to_string());
    }
    crate::ai::engine::assistant_chat(&state, conversation_id, trimmed).await
}

#[tauri::command]
pub fn assistant_get_conversations(
    state: State<'_, DbState>,
    limit: Option<u32>,
) -> Result<Vec<crate::db::repository::Conversation>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::db::repository::get_conversations(&conn, limit.unwrap_or(25))
}

#[tauri::command]
pub fn assistant_get_messages(
    state: State<'_, DbState>,
    conversation_id: i64,
) -> Result<Vec<crate::db::repository::ConversationMessage>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::db::repository::get_conversation_messages(&conn, conversation_id)
}

#[tauri::command]
pub fn assistant_create_conversation(
    state: State<'_, DbState>,
    title: String,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    let provider = crate::ai::client::get_active_provider(&conn);
    let model = crate::ai::client::get_provider_model(&conn, provider);
    crate::db::repository::create_conversation(&conn, &title, provider.as_str(), &model)
}

#[tauri::command]
pub fn assistant_delete_conversation(
    state: State<'_, DbState>,
    conversation_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::db::repository::delete_conversation(&conn, conversation_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Finance Intelligence Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn finance_get_config(
    state: State<'_, DbState>,
) -> Result<crate::finance::FinanceConfig, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    Ok(crate::finance::get_finance_config(&conn))
}

#[tauri::command]
pub fn finance_save_config(
    state: State<'_, DbState>,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::finance::save_finance_config(&conn, api_key, provider)
}

#[tauri::command]
pub async fn finance_get_quote(
    state: State<'_, DbState>,
    symbol: String,
) -> Result<crate::finance::StockQuote, String> {
    let sym = symbol.trim().to_uppercase();
    if sym.is_empty() || sym.len() > 16 {
        return Err("Symbol must be between 1 and 16 characters".to_string());
    }
    let api_key = {
        let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        crate::finance::client::get_finnhub_key(&conn)
    };
    crate::finance::get_quote(api_key.as_deref(), &sym).await
}

#[tauri::command]
pub async fn finance_get_watchlist_quotes(
    state: State<'_, DbState>,
    symbols: Option<Vec<String>>,
) -> Result<Vec<crate::finance::StockQuote>, String> {
    let (api_key, watchlist) = {
        let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let key = crate::finance::client::get_finnhub_key(&conn);
        let list = symbols.unwrap_or_else(|| {
            let cfg = crate::finance::get_finance_config(&conn);
            cfg.watchlist
        });
        (key, list)
    };
    crate::finance::get_watchlist_quotes(api_key.as_deref(), &watchlist).await
}

#[tauri::command]
pub fn finance_save_watchlist(
    state: State<'_, DbState>,
    symbols: Vec<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::finance::save_watchlist(&conn, &symbols)
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop Notification Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn notification_get_preferences(
    state: State<'_, DbState>,
) -> Result<crate::notifications::NotificationPreferences, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    Ok(crate::notifications::get_notification_preferences(&conn))
}

#[tauri::command]
pub fn notification_save_preferences(
    state: State<'_, DbState>,
    preferences: crate::notifications::NotificationPreferences,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::notifications::save_notification_preferences(&conn, &preferences)
}

#[tauri::command]
pub fn notification_send(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
    title: String,
    body: String,
    topic: String,
    force: Option<bool>,
) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::notifications::dispatch_notification(&app, &conn, &title, &body, &topic, force.unwrap_or(false))
}

#[tauri::command]
pub async fn ai_process_news(
    state: State<'_, DbState>,
    category: Option<String>,
    limit: Option<u32>,
    force_refresh: Option<bool>,
) -> Result<Vec<crate::db::repository::StoryClusterWithArticles>, String> {
    crate::ai::process_news_intelligence(
        &state,
        category.as_deref(),
        limit.unwrap_or(40),
        force_refresh.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub fn ai_get_stories(
    state: State<'_, DbState>,
    category: Option<String>,
    search: Option<String>,
    sort_by: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<crate::db::repository::StoryClusterWithArticles>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::db::repository::get_story_clusters_with_articles(
        &conn,
        category.as_deref(),
        search.as_deref(),
        sort_by.as_deref(),
        limit.unwrap_or(20),
    )
}

#[tauri::command]
pub async fn ai_generate_briefing(
    state: State<'_, DbState>,
    briefing_type: String,
    briefing_length: String,
) -> Result<Briefing, String> {
    crate::ai::generate_briefing(&state, &briefing_type, &briefing_length).await
}

#[tauri::command]
pub fn ai_get_briefings(
    state: State<'_, DbState>,
    briefing_type: Option<String>,
    search: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<Briefing>, String> {
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    crate::db::repository::get_briefings_by_type(
        &conn,
        briefing_type.as_deref(),
        search.as_deref(),
        limit.unwrap_or(15),
    )
}

#[tauri::command]
pub async fn ai_ask_question(
    state: State<'_, DbState>,
    question: String,
    story_context: Option<String>,
) -> Result<crate::ai::AiAnswer, String> {
    let trimmed = question.trim();
    if trimmed.is_empty() {
        return Err("Question cannot be empty".to_string());
    }
    if trimmed.len() > 2000 {
        return Err("Question exceeds maximum length of 2,000 characters".to_string());
    }
    crate::ai::ask_question(&state, trimmed, story_context.as_deref()).await
}

// ─────────────────────────────────────────────────────────────────────────────
// Database & Storage Management Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_get_storage_breakdown(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<StorageBreakdown, String> {
    let db_path = crate::db::connection::resolve_db_path(&app)?;
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_storage_breakdown(&conn, &db_path)
}

#[tauri::command]
pub fn db_clear_temporary_cache(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
) -> Result<CleanupResult, String> {
    let db_path = crate::db::connection::resolve_db_path(&app)?;
    let conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    clear_temporary_cache(&conn, &db_path)
}

#[tauri::command]
pub fn db_backup_database(
    app: tauri::AppHandle,
    state: State<'_, DbState>,
    dest_path: Option<String>,
) -> Result<String, String> {
    let db_path = crate::db::connection::resolve_db_path(&app)?;
    let mut conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    backup_database(&mut conn, &db_path, dest_path.as_deref())
}

#[tauri::command]
pub fn db_restore_database(
    state: State<'_, DbState>,
    backup_file_path: String,
) -> Result<(), String> {
    let trimmed = backup_file_path.trim();
    if trimmed.is_empty() {
        return Err("Backup file path cannot be empty".to_string());
    }
    let mut conn = state.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    restore_database(&mut conn, trimmed)
}

