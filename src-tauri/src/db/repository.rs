//! Repository layer — all typed database operations.
//!
//! Each function takes a `&Connection` (obtained by locking `DbState`) and
//! returns `Result<T, String>` to keep error handling uniform across Tauri commands.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbSetting {
    pub id: i64,
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsSource {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub category: String,
    pub enabled: bool,
    pub created_at: String,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub last_fetched_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub source_id: i64,
    pub article_url: String,
    pub category: String,
    pub published_at: Option<String>,
    pub fetched_at: String,
    pub publisher: Option<String>,
    pub guid: Option<String>,
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewArticle {
    pub title: String,
    pub description: Option<String>,
    pub source_id: i64,
    pub article_url: String,
    pub category: String,
    pub published_at: Option<String>,
    pub publisher: Option<String>,
    pub guid: Option<String>,
    pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Briefing {
    pub id: i64,
    pub title: String,
    pub summary: String,
    pub category: String,
    pub created_at: String,
    pub last_updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewBriefing {
    pub title: String,
    pub summary: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryPreference {
    pub id: i64,
    pub category: String,
    pub enabled: bool,
    pub updated_at: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

/// Upsert a key-value setting (insert or replace on conflict).
pub fn upsert_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value, updated_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET
             value      = excluded.value,
             updated_at = excluded.updated_at",
        params![key, value],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to upsert setting '{}': {e}", key))
}

/// Retrieve the value for a settings key.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get setting '{}': {e}", key)),
    }
}

/// Return all settings rows.
pub fn get_all_settings(conn: &Connection) -> Result<Vec<DbSetting>, String> {
    let mut stmt = conn
        .prepare("SELECT id, key, value, updated_at FROM settings ORDER BY key")
        .map_err(|e| format!("Failed to prepare get_all_settings: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DbSetting {
                id: row.get(0)?,
                key: row.get(1)?,
                value: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query settings: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect settings: {e}"))?;

    Ok(rows)
}

/// Delete a setting by key.
pub fn delete_setting(conn: &Connection, key: &str) -> Result<(), String> {
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])
        .map(|_| ())
        .map_err(|e| format!("Failed to delete setting '{}': {e}", key))
}

// ─────────────────────────────────────────────────────────────────────────────
// News Sources
// ─────────────────────────────────────────────────────────────────────────────

/// Return all news sources, optionally filtered by category.
pub fn get_news_sources(
    conn: &Connection,
    category: Option<&str>,
) -> Result<Vec<NewsSource>, String> {
    let (sql, cat_param) = match category {
        Some(c) => (
            "SELECT id, name, url, category, enabled, created_at, etag, last_modified, last_fetched_at, last_error
             FROM news_sources WHERE category = ?1 ORDER BY name",
            Some(c.to_string()),
        ),
        None => (
            "SELECT id, name, url, category, enabled, created_at, etag, last_modified, last_fetched_at, last_error
             FROM news_sources ORDER BY category, name",
            None,
        ),
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("Failed to prepare get_news_sources: {e}"))?;

    let map_row = |row: &rusqlite::Row| {
        Ok(NewsSource {
            id: row.get(0)?,
            name: row.get(1)?,
            url: row.get(2)?,
            category: row.get(3)?,
            enabled: row.get::<_, i64>(4)? != 0,
            created_at: row.get(5)?,
            etag: row.get(6)?,
            last_modified: row.get(7)?,
            last_fetched_at: row.get(8)?,
            last_error: row.get(9)?,
        })
    };

    let rows = if let Some(cat) = cat_param {
        stmt.query_map(params![cat], map_row)
    } else {
        stmt.query_map([], map_row)
    }
    .map_err(|e| format!("Failed to query news_sources: {e}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect news_sources: {e}"))?;

    Ok(rows)
}

/// Returns only enabled news sources for synchronization.
pub fn get_enabled_news_sources(conn: &Connection) -> Result<Vec<NewsSource>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, url, category, enabled, created_at, etag, last_modified, last_fetched_at, last_error
             FROM news_sources WHERE enabled = 1 ORDER BY id",
        )
        .map_err(|e| format!("Failed to prepare get_enabled_news_sources: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(NewsSource {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                category: row.get(3)?,
                enabled: true,
                created_at: row.get(5)?,
                etag: row.get(6)?,
                last_modified: row.get(7)?,
                last_fetched_at: row.get(8)?,
                last_error: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query enabled news_sources: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect enabled news_sources: {e}"))?;

    Ok(rows)
}

/// Adds a new user-defined news source.
pub fn add_news_source(
    conn: &Connection,
    name: &str,
    url: &str,
    category: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO news_sources (name, url, category, enabled)
         VALUES (?1, ?2, ?3, 1)",
        params![name.trim(), url.trim(), category.trim()],
    )
    .map_err(|e| format!("Failed to add news source: {e}"))?;

    Ok(conn.last_insert_rowid())
}

/// Removes a news source by ID (cascades article deletions).
pub fn delete_news_source(conn: &Connection, source_id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM news_sources WHERE id = ?1", params![source_id])
        .map(|_| ())
        .map_err(|e| format!("Failed to delete news source {source_id}: {e}"))
}

/// Toggle the `enabled` flag for a news source by id.
pub fn set_news_source_enabled(
    conn: &Connection,
    source_id: i64,
    enabled: bool,
) -> Result<(), String> {
    conn.execute(
        "UPDATE news_sources SET enabled = ?1 WHERE id = ?2",
        params![enabled as i64, source_id],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to update news_source {source_id}: {e}"))
}

/// Updates synchronization metadata (ETag, Last-Modified, Last-Fetched, Error) after a fetch attempt.
pub fn update_news_source_sync(
    conn: &Connection,
    source_id: i64,
    etag: Option<&str>,
    last_modified: Option<&str>,
    last_error: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE news_sources SET
             etag = COALESCE(?1, etag),
             last_modified = COALESCE(?2, last_modified),
             last_fetched_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
             last_error = ?3
         WHERE id = ?4",
        params![etag, last_modified, last_error, source_id],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to update sync metadata for source {source_id}: {e}"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Articles
// ─────────────────────────────────────────────────────────────────────────────

/// Insert multiple articles in a single transaction with multi-attribute deduplication:
/// - Rejects duplicate canonical article_url (UNIQUE constraint)
/// - Rejects identical guid or content_hash if already present
pub fn insert_articles(conn: &Connection, articles: &[NewArticle]) -> Result<u64, String> {
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;

    let mut inserted: u64 = 0;

    let result = (|| -> Result<(), String> {
        let mut check_stmt = conn
            .prepare(
                "SELECT 1 FROM articles
                 WHERE article_url = ?1
                    OR (guid IS NOT NULL AND guid = ?2)
                    OR (content_hash IS NOT NULL AND content_hash = ?3)
                 LIMIT 1",
            )
            .map_err(|e| format!("Failed to prepare check statement: {e}"))?;

        let mut insert_stmt = conn
            .prepare(
                "INSERT INTO articles
                     (title, description, source_id, article_url, category, published_at, publisher, guid, content_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            )
            .map_err(|e| format!("Failed to prepare article insert: {e}"))?;

        for art in articles {
            // Check for duplicate article
            let exists: bool = check_stmt
                .exists(params![art.article_url, art.guid, art.content_hash])
                .unwrap_or(false);

            if exists {
                continue; // Skip duplicate article
            }

            let n = insert_stmt
                .execute(params![
                    art.title,
                    art.description,
                    art.source_id,
                    art.article_url,
                    art.category,
                    art.published_at,
                    art.publisher,
                    art.guid,
                    art.content_hash,
                ])
                .map_err(|e| format!("Failed to insert article '{}': {e}", art.title))?;

            inserted += n as u64;
        }

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(inserted)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

/// Return recent articles, optionally filtered by category, with a row limit.
pub fn get_articles(
    conn: &Connection,
    category: Option<&str>,
    limit: u32,
) -> Result<Vec<Article>, String> {
    get_articles_paginated(conn, category, None, limit, 0)
}

/// Return articles with optional category filter, text search query, and pagination.
pub fn get_articles_paginated(
    conn: &Connection,
    category: Option<&str>,
    search: Option<&str>,
    limit: u32,
    offset: u32,
) -> Result<Vec<Article>, String> {
    let limit = limit.clamp(1, 100);

    let (sql, params_vec): (String, Vec<rusqlite::types::Value>) = match (category, search) {
        (Some(cat), Some(s)) if !cat.eq_ignore_ascii_case("all") && !s.trim().is_empty() => {
            let pattern = format!("%{}%", s.trim());
            (
                "SELECT id, title, description, source_id, article_url, category, published_at, fetched_at, publisher, guid, content_hash
                 FROM articles
                 WHERE category = ?1 AND (title LIKE ?2 OR description LIKE ?2)
                 ORDER BY COALESCE(published_at, fetched_at) DESC
                 LIMIT ?3 OFFSET ?4".to_string(),
                vec![cat.to_string().into(), pattern.into(), limit.into(), offset.into()],
            )
        }
        (Some(cat), _) if !cat.eq_ignore_ascii_case("all") => {
            (
                "SELECT id, title, description, source_id, article_url, category, published_at, fetched_at, publisher, guid, content_hash
                 FROM articles
                 WHERE category = ?1
                 ORDER BY COALESCE(published_at, fetched_at) DESC
                 LIMIT ?2 OFFSET ?3".to_string(),
                vec![cat.to_string().into(), limit.into(), offset.into()],
            )
        }
        (_, Some(s)) if !s.trim().is_empty() => {
            let pattern = format!("%{}%", s.trim());
            (
                "SELECT id, title, description, source_id, article_url, category, published_at, fetched_at, publisher, guid, content_hash
                 FROM articles
                 WHERE title LIKE ?1 OR description LIKE ?1
                 ORDER BY COALESCE(published_at, fetched_at) DESC
                 LIMIT ?2 OFFSET ?3".to_string(),
                vec![pattern.into(), limit.into(), offset.into()],
            )
        }
        _ => {
            (
                "SELECT id, title, description, source_id, article_url, category, published_at, fetched_at, publisher, guid, content_hash
                 FROM articles
                 ORDER BY COALESCE(published_at, fetched_at) DESC
                 LIMIT ?1 OFFSET ?2".to_string(),
                vec![limit.into(), offset.into()],
            )
        }
    };

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare get_articles: {e}"))?;

    let map_row = |row: &rusqlite::Row| {
        Ok(Article {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            source_id: row.get(3)?,
            article_url: row.get(4)?,
            category: row.get(5)?,
            published_at: row.get(6)?,
            fetched_at: row.get(7)?,
            publisher: row.get(8)?,
            guid: row.get(9)?,
            content_hash: row.get(10)?,
        })
    };

    let rows = stmt
        .query_map(rusqlite::params_from_iter(params_vec), map_row)
        .map_err(|e| format!("Failed to query articles: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect articles: {e}"))?;

    Ok(rows)
}

/// Delete articles older than `days` days to keep the database lean.
pub fn prune_old_articles(conn: &Connection, days: u32) -> Result<u64, String> {
    let deleted = conn
        .execute(
            "DELETE FROM articles
             WHERE fetched_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?1)",
            params![format!("-{days} days")],
        )
        .map_err(|e| format!("Failed to prune articles: {e}"))?;

    Ok(deleted as u64)
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefings
// ─────────────────────────────────────────────────────────────────────────────

/// Upsert a briefing — if a briefing for the same category exists today,
/// update its summary; otherwise insert a new row.
pub fn upsert_briefing(conn: &Connection, briefing: &NewBriefing) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO briefings (title, summary, category)
         VALUES (?1, ?2, ?3)
         ON CONFLICT DO NOTHING",
        params![briefing.title, briefing.summary, briefing.category],
    )
    .map_err(|e| format!("Failed to insert briefing: {e}"))?;

    let id = conn
        .query_row(
            "SELECT id FROM briefings WHERE category = ?1 ORDER BY created_at DESC LIMIT 1",
            params![briefing.category],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("Failed to retrieve briefing id: {e}"))?;

    conn.execute(
        "UPDATE briefings SET summary = ?1, last_updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?2",
        params![briefing.summary, id],
    )
    .map_err(|e| format!("Failed to update briefing: {e}"))?;

    Ok(id)
}

/// Return the latest briefing for each category.
pub fn get_latest_briefings(conn: &Connection) -> Result<Vec<Briefing>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, summary, category, created_at, last_updated_at
             FROM briefings
             WHERE id IN (
                 SELECT MAX(id) FROM briefings GROUP BY category
             )
             ORDER BY category",
        )
        .map_err(|e| format!("Failed to prepare get_latest_briefings: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Briefing {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
                last_updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query briefings: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect briefings: {e}"))?;

    Ok(rows)
}

/// Return briefings for a specific category, newest first.
pub fn get_briefings_by_category(
    conn: &Connection,
    category: &str,
    limit: u32,
) -> Result<Vec<Briefing>, String> {
    let limit = limit.clamp(1, 100);

    let mut stmt = conn
        .prepare(
            "SELECT id, title, summary, category, created_at, last_updated_at
             FROM briefings WHERE category = ?1
             ORDER BY created_at DESC LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare get_briefings_by_category: {e}"))?;

    let rows = stmt
        .query_map(params![category, limit], |row| {
            Ok(Briefing {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
                last_updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query briefings by category: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect briefings: {e}"))?;

    Ok(rows)
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Preferences
// ─────────────────────────────────────────────────────────────────────────────

/// Return all per-category user preferences.
pub fn get_category_preferences(conn: &Connection) -> Result<Vec<CategoryPreference>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, category, enabled, updated_at
             FROM user_category_preferences ORDER BY category",
        )
        .map_err(|e| format!("Failed to prepare get_category_preferences: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CategoryPreference {
                id: row.get(0)?,
                category: row.get(1)?,
                enabled: row.get::<_, i64>(2)? != 0,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query category_preferences: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect category_preferences: {e}"))?;

    Ok(rows)
}

/// Upsert a single category preference.
pub fn upsert_category_preference(
    conn: &Connection,
    category: &str,
    enabled: bool,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO user_category_preferences (category, enabled, updated_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(category) DO UPDATE SET
             enabled    = excluded.enabled,
             updated_at = excluded.updated_at",
        params![category, enabled as i64],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to upsert category preference '{}': {e}", category))
}

/// Return basic database statistics for diagnostics.
pub fn get_db_stats(conn: &Connection) -> Result<serde_json::Value, String> {
    let db_path: String = conn
        .query_row("PRAGMA database_list", [], |r| r.get(2))
        .unwrap_or_else(|_| "Unknown".to_string());

    let settings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM settings", [], |r| r.get(0))
        .unwrap_or(0);
    let sources_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM news_sources", [], |r| r.get(0))
        .unwrap_or(0);
    let articles_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM articles", [], |r| r.get(0))
        .unwrap_or(0);
    let briefings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM briefings", [], |r| r.get(0))
        .unwrap_or(0);
    let prefs_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM user_category_preferences", [], |r| r.get(0))
        .unwrap_or(0);

    Ok(serde_json::json!({
        "db_path": db_path,
        "settings": settings_count,
        "news_sources": sources_count,
        "articles": articles_count,
        "briefings": briefings_count,
        "category_preferences": prefs_count,
    }))
}
