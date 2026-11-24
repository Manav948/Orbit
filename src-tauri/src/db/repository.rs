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
    pub briefing_type: Option<String>,
    pub briefing_length: Option<String>,
    pub model_used: Option<String>,
    pub articles_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewBriefing {
    pub title: String,
    pub summary: String,
    pub category: String,
    pub briefing_type: Option<String>,
    pub briefing_length: Option<String>,
    pub model_used: Option<String>,
    pub articles_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryCluster {
    pub id: i64,
    pub cluster_hash: String,
    pub category: String,
    pub title: String,
    pub what_happened: String,
    pub why_it_happened: String,
    pub why_it_matters: String,
    pub what_happens_next: String,
    pub what_is_uncertain: String,
    pub simple_summary: Option<String>,
    pub detailed_summary: Option<String>,
    pub decision_summary: Option<String>,
    pub importance_score: i64,
    pub model_used: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryClusterWithArticles {
    pub cluster: StoryCluster,
    pub articles: Vec<Article>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewStoryCluster {
    pub cluster_hash: String,
    pub category: String,
    pub title: String,
    pub what_happened: String,
    pub why_it_happened: String,
    pub why_it_matters: String,
    pub what_happens_next: String,
    pub what_is_uncertain: String,
    pub simple_summary: Option<String>,
    pub detailed_summary: Option<String>,
    pub decision_summary: Option<String>,
    pub importance_score: i64,
    pub model_used: String,
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

/// Return a distinct list of all publishers in the articles database.
pub fn get_publishers(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT publisher FROM articles WHERE publisher IS NOT NULL AND TRIM(publisher) != '' ORDER BY publisher ASC")
        .map_err(|e| format!("Failed to prepare get_publishers: {e}"))?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query publishers: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect publishers: {e}"))?;

    Ok(rows)
}

/// Return recent articles, optionally filtered by category, with a row limit.
pub fn get_articles(
    conn: &Connection,
    category: Option<&str>,
    limit: u32,
) -> Result<Vec<Article>, String> {
    get_articles_paginated(conn, category, None, None, None, limit, 0)
}

/// Return articles with optional category filter, publisher filter, text search query, sorting, and pagination.
pub fn get_articles_paginated(
    conn: &Connection,
    category: Option<&str>,
    publisher: Option<&str>,
    search: Option<&str>,
    sort_by: Option<&str>,
    limit: u32,
    offset: u32,
) -> Result<Vec<Article>, String> {
    let limit = limit.clamp(1, 100);

    let mut conditions = Vec::new();
    let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

    if let Some(cat) = category {
        if !cat.eq_ignore_ascii_case("all") && !cat.trim().is_empty() {
            conditions.push("category = ?");
            params_vec.push(cat.trim().to_string().into());
        }
    }

    if let Some(pub_name) = publisher {
        if !pub_name.eq_ignore_ascii_case("all") && !pub_name.trim().is_empty() {
            conditions.push("publisher = ?");
            params_vec.push(pub_name.trim().to_string().into());
        }
    }

    if let Some(s) = search {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            conditions.push("(title LIKE ? OR description LIKE ?)");
            let pattern = format!("%{trimmed}%");
            params_vec.push(pattern.clone().into());
            params_vec.push(pattern.into());
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let order_clause = match sort_by {
        Some("importance") => "ORDER BY CASE 
            WHEN title LIKE '%breaking%' OR title LIKE '%alert%' OR title LIKE '%crisis%' THEN 1
            WHEN publisher IN ('Reuters World', 'BBC News', 'Associated Press', 'Bloomberg') THEN 2
            ELSE 3 END ASC, COALESCE(published_at, fetched_at) DESC",
        _ => "ORDER BY COALESCE(published_at, fetched_at) DESC",
    };

    let sql = format!(
        "SELECT id, title, description, source_id, article_url, category, published_at, fetched_at, publisher, guid, content_hash
         FROM articles
         {where_clause}
         {order_clause}
         LIMIT ? OFFSET ?"
    );

    params_vec.push(limit.into());
    params_vec.push(offset.into());

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
        "INSERT INTO briefings (title, summary, category, briefing_type, briefing_length, model_used, articles_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT DO NOTHING",
        params![
            briefing.title,
            briefing.summary,
            briefing.category,
            briefing.briefing_type.as_deref().unwrap_or("general"),
            briefing.briefing_length.as_deref().unwrap_or("standard"),
            briefing.model_used.as_deref().unwrap_or("gpt-4o-mini"),
            briefing.articles_count.unwrap_or(0),
        ],
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

/// Insert a new standalone briefing record.
pub fn insert_briefing(conn: &Connection, briefing: &NewBriefing) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO briefings (title, summary, category, briefing_type, briefing_length, model_used, articles_count, created_at, last_updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        params![
            briefing.title,
            briefing.summary,
            briefing.category,
            briefing.briefing_type.as_deref().unwrap_or("general"),
            briefing.briefing_length.as_deref().unwrap_or("standard"),
            briefing.model_used.as_deref().unwrap_or("gpt-4o-mini"),
            briefing.articles_count.unwrap_or(0),
        ],
    )
    .map_err(|e| format!("Failed to insert briefing: {e}"))?;

    Ok(conn.last_insert_rowid())
}

/// Return the latest briefing for each category.
pub fn get_latest_briefings(conn: &Connection) -> Result<Vec<Briefing>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, summary, category, created_at, last_updated_at, briefing_type, briefing_length, model_used, articles_count
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
                briefing_type: row.get(6).ok(),
                briefing_length: row.get(7).ok(),
                model_used: row.get(8).ok(),
                articles_count: row.get(9).ok(),
            })
        })
        .map_err(|e| format!("Failed to query briefings: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect briefings: {e}"))?;

    Ok(rows)
}

/// Return briefings for a specific category or type, newest first.
pub fn get_briefings_by_category(
    conn: &Connection,
    category: &str,
    limit: u32,
) -> Result<Vec<Briefing>, String> {
    let limit = limit.clamp(1, 100);

    let mut stmt = conn
        .prepare(
            "SELECT id, title, summary, category, created_at, last_updated_at, briefing_type, briefing_length, model_used, articles_count
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
                briefing_type: row.get(6).ok(),
                briefing_length: row.get(7).ok(),
                model_used: row.get(8).ok(),
                articles_count: row.get(9).ok(),
            })
        })
        .map_err(|e| format!("Failed to query briefings by category: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect briefings: {e}"))?;

    Ok(rows)
}

fn map_briefing_row(row: &rusqlite::Row) -> rusqlite::Result<Briefing> {
    Ok(Briefing {
        id: row.get(0)?,
        title: row.get(1)?,
        summary: row.get(2)?,
        category: row.get(3)?,
        created_at: row.get(4)?,
        last_updated_at: row.get(5)?,
        briefing_type: row.get(6).ok(),
        briefing_length: row.get(7).ok(),
        model_used: row.get(8).ok(),
        articles_count: row.get(9).ok(),
    })
}

/// Return recent briefings filtered optionally by type and search query.
pub fn get_briefings_by_type(
    conn: &Connection,
    briefing_type: Option<&str>,
    search: Option<&str>,
    limit: u32,
) -> Result<Vec<Briefing>, String> {
    let limit = limit.clamp(1, 100);

    let mut conditions = Vec::new();
    let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

    if let Some(bt) = briefing_type {
        if !bt.eq_ignore_ascii_case("all") && !bt.trim().is_empty() {
            conditions.push("briefing_type = ?");
            params_vec.push(bt.trim().to_string().into());
        }
    }

    if let Some(s) = search {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            conditions.push("(title LIKE ? OR summary LIKE ?)");
            let pattern = format!("%{trimmed}%");
            params_vec.push(pattern.clone().into());
            params_vec.push(pattern.into());
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, title, summary, category, created_at, last_updated_at, briefing_type, briefing_length, model_used, articles_count
         FROM briefings
         {where_clause}
         ORDER BY created_at DESC
         LIMIT ?"
    );

    params_vec.push(limit.into());

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare get_briefings_by_type: {e}"))?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(params_vec), map_briefing_row)
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect briefings by type: {e}"))?;

    Ok(rows)
}

// ─────────────────────────────────────────────────────────────────────────────
// Story Clusters & AI Intelligence
// ─────────────────────────────────────────────────────────────────────────────

fn map_cluster_row(row: &rusqlite::Row) -> rusqlite::Result<StoryCluster> {
    Ok(StoryCluster {
        id: row.get(0)?,
        cluster_hash: row.get(1)?,
        category: row.get(2)?,
        title: row.get(3)?,
        what_happened: row.get(4)?,
        why_it_happened: row.get(5)?,
        why_it_matters: row.get(6)?,
        what_happens_next: row.get(7)?,
        what_is_uncertain: row.get(8)?,
        simple_summary: row.get(9)?,
        detailed_summary: row.get(10)?,
        decision_summary: row.get(11)?,
        importance_score: row.get(12)?,
        model_used: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

/// Find an existing story cluster by its unique cluster hash to avoid re-processing.
pub fn find_story_cluster_by_hash(
    conn: &Connection,
    cluster_hash: &str,
) -> Result<Option<StoryCluster>, String> {
    let res = conn.query_row(
        "SELECT id, cluster_hash, category, title, what_happened, why_it_happened, why_it_matters,
                what_happens_next, what_is_uncertain, simple_summary, detailed_summary, decision_summary,
                importance_score, model_used, created_at, updated_at
         FROM story_clusters WHERE cluster_hash = ?1 LIMIT 1",
        params![cluster_hash],
        map_cluster_row,
    );

    match res {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to find story cluster: {e}")),
    }
}

/// Insert a new story cluster and associate it with its source articles.
pub fn insert_story_cluster(
    conn: &Connection,
    cluster: &NewStoryCluster,
    article_ids: &[i64],
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO story_clusters (
            cluster_hash, category, title, what_happened, why_it_happened, why_it_matters,
            what_happens_next, what_is_uncertain, simple_summary, detailed_summary, decision_summary,
            importance_score, model_used
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            cluster.cluster_hash,
            cluster.category,
            cluster.title,
            cluster.what_happened,
            cluster.why_it_happened,
            cluster.why_it_matters,
            cluster.what_happens_next,
            cluster.what_is_uncertain,
            cluster.simple_summary,
            cluster.detailed_summary,
            cluster.decision_summary,
            cluster.importance_score,
            cluster.model_used,
        ],
    )
    .map_err(|e| format!("Failed to insert story cluster: {e}"))?;

    let cluster_id = conn.last_insert_rowid();

    for &article_id in article_ids {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO cluster_articles (cluster_id, article_id) VALUES (?1, ?2)",
            params![cluster_id, article_id],
        );
    }

    Ok(cluster_id)
}

/// Return story clusters with their supporting articles attached, with category, search, and sort options.
pub fn get_story_clusters_with_articles(
    conn: &Connection,
    category: Option<&str>,
    search: Option<&str>,
    sort_by: Option<&str>,
    limit: u32,
) -> Result<Vec<StoryClusterWithArticles>, String> {
    let limit = limit.clamp(1, 100);

    let mut conditions = Vec::new();
    let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

    if let Some(cat) = category {
        if !cat.eq_ignore_ascii_case("all") && !cat.trim().is_empty() {
            conditions.push("category = ?");
            params_vec.push(cat.trim().to_string().into());
        }
    }

    if let Some(s) = search {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            conditions.push("(title LIKE ? OR what_happened LIKE ? OR simple_summary LIKE ?)");
            let pattern = format!("%{trimmed}%");
            params_vec.push(pattern.clone().into());
            params_vec.push(pattern.clone().into());
            params_vec.push(pattern.into());
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let order_clause = match sort_by {
        Some("importance") => "ORDER BY importance_score DESC, created_at DESC",
        _ => "ORDER BY created_at DESC, importance_score DESC",
    };

    let sql = format!(
        "SELECT id, cluster_hash, category, title, what_happened, why_it_happened, why_it_matters,
                what_happens_next, what_is_uncertain, simple_summary, detailed_summary, decision_summary,
                importance_score, model_used, created_at, updated_at
         FROM story_clusters
         {where_clause}
         {order_clause}
         LIMIT ?"
    );

    params_vec.push(limit.into());

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Prepare error: {e}"))?;

    let clusters = stmt
        .query_map(rusqlite::params_from_iter(params_vec), map_cluster_row)
        .map_err(|e| format!("Query error: {e}"))?
        .collect::<Result<Vec<StoryCluster>, _>>()
        .map_err(|e| format!("Collect error: {e}"))?;

    let mut result = Vec::new();
    for cluster in clusters {
        let mut art_stmt = conn.prepare(
            "SELECT a.id, a.title, a.description, a.source_id, a.article_url, a.category,
                    a.published_at, a.fetched_at, a.publisher, a.guid, a.content_hash
             FROM articles a
             INNER JOIN cluster_articles ca ON ca.article_id = a.id
             WHERE ca.cluster_id = ?1
             ORDER BY a.published_at DESC LIMIT 5",
        ).map_err(|e| format!("Failed to prepare cluster articles statement: {e}"))?;

        let articles = art_stmt
            .query_map(params![cluster.id], |row| {
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
            })
            .map_err(|e| format!("Query cluster articles error: {e}"))?
            .collect::<Result<Vec<Article>, _>>()
            .map_err(|e| format!("Failed to collect cluster articles: {e}"))?;

        result.push(StoryClusterWithArticles { cluster, articles });
    }

    Ok(result)
}

/// Search articles based on keywords for conversational question answering (RAG).
pub fn search_articles_for_question(
    conn: &Connection,
    keywords: &[String],
    limit: u32,
) -> Result<Vec<Article>, String> {
    let limit = limit.clamp(1, 30);
    if keywords.is_empty() {
        return get_articles(conn, None, limit);
    }

    let mut conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    for kw in keywords {
        let pattern = format!("%{kw}%");
        conditions.push("(a.title LIKE ? OR a.description LIKE ?)");
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern));
    }

    let where_clause = conditions.join(" OR ");
    let query_str = format!(
        "SELECT a.id, a.title, a.description, a.source_id, a.article_url, a.category,
                a.published_at, a.fetched_at, a.publisher, a.guid, a.content_hash
         FROM articles a
         WHERE {where_clause}
         ORDER BY a.published_at DESC, a.fetched_at DESC
         LIMIT {limit}"
    );

    let mut stmt = conn
        .prepare(&query_str)
        .map_err(|e| format!("Failed to prepare search_articles_for_question: {e}"))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
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
        })
        .map_err(|e| format!("Failed to execute search_articles_for_question: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect searched articles: {e}"))?;

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

// ─────────────────────────────────────────────────────────────────────────────
// Conversations & Assistant Messages
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: i64,
    pub title: String,
    pub provider: String,
    pub model: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: String,
    pub sources_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct NotificationLog {
    pub id: i64,
    pub topic: String,
    pub title: String,
    pub body: String,
    pub sent_at: String,
}

pub fn create_conversation(
    conn: &Connection,
    title: &str,
    provider: &str,
    model: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO conversations (title, provider, model, created_at, updated_at)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        params![title, provider, model],
    )
    .map_err(|e| format!("Failed to create conversation: {e}"))?;

    Ok(conn.last_insert_rowid())
}

pub fn get_conversations(conn: &Connection, limit: u32) -> Result<Vec<Conversation>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, provider, model, created_at, updated_at
             FROM conversations
             ORDER BY updated_at DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare get_conversations: {e}"))?;

    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                provider: row.get(2)?,
                model: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query conversations: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect conversations: {e}"))?;

    Ok(rows)
}

pub fn get_conversation(conn: &Connection, id: i64) -> Result<Option<Conversation>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, provider, model, created_at, updated_at
             FROM conversations
             WHERE id = ?1",
        )
        .map_err(|e| format!("Failed to prepare get_conversation: {e}"))?;

    let mut rows = stmt
        .query_map(params![id], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                provider: row.get(2)?,
                model: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query conversation: {e}"))?;

    if let Some(first) = rows.next() {
        first.map(Some).map_err(|e| format!("Row read error: {e}"))
    } else {
        Ok(None)
    }
}

pub fn delete_conversation(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete conversation: {e}"))?;
    Ok(())
}

pub fn add_conversation_message(
    conn: &Connection,
    conversation_id: i64,
    role: &str,
    content: &str,
    sources_json: Option<&str>,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO conversation_messages (conversation_id, role, content, sources_json, created_at)
         VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        params![conversation_id, role, content, sources_json],
    )
    .map_err(|e| format!("Failed to add conversation message: {e}"))?;

    let msg_id = conn.last_insert_rowid();

    // Update conversation updated_at timestamp
    let _ = conn.execute(
        "UPDATE conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?1",
        params![conversation_id],
    );

    Ok(msg_id)
}

pub fn get_conversation_messages(
    conn: &Connection,
    conversation_id: i64,
) -> Result<Vec<ConversationMessage>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, conversation_id, role, content, sources_json, created_at
             FROM conversation_messages
             WHERE conversation_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|e| format!("Failed to prepare get_conversation_messages: {e}"))?;

    let rows = stmt
        .query_map(params![conversation_id], |row| {
            Ok(ConversationMessage {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                sources_json: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query conversation messages: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect conversation messages: {e}"))?;

    Ok(rows)
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Duplicate & Quiet Hours Check
// ─────────────────────────────────────────────────────────────────────────────

pub fn can_send_notification(
    conn: &Connection,
    topic: &str,
    title: &str,
    min_interval_secs: i64,
) -> Result<bool, String> {
    // 1. Check if notifications are globally enabled
    let notifs_enabled = get_setting(conn, "notifications_enabled")
        .unwrap_or(Some("true".to_string()))
        .unwrap_or_else(|| "true".to_string())
        == "true";

    if !notifs_enabled {
        return Ok(false);
    }

    // 2. Check topic-specific toggle
    let topic_key = format!("notifications_{topic}");
    if let Ok(Some(val)) = get_setting(conn, &topic_key) {
        if val == "false" {
            return Ok(false);
        }
    }

    // 3. Check quiet hours
    let quiet_enabled = get_setting(conn, "quiet_hours_enabled")
        .unwrap_or(Some("false".to_string()))
        .unwrap_or_else(|| "false".to_string())
        == "true";

    if quiet_enabled {
        let start_time = get_setting(conn, "quiet_hours_start")
            .unwrap_or(Some("22:00".to_string()))
            .unwrap_or_else(|| "22:00".to_string());
        let end_time = get_setting(conn, "quiet_hours_end")
            .unwrap_or(Some("08:00".to_string()))
            .unwrap_or_else(|| "08:00".to_string());

        // Parse HH:MM
        let (now_h, now_m) = {
            let now = chrono_like_now_hm();
            now
        };
        let (start_h, start_m) = parse_hm(&start_time);
        let (end_h, end_m) = parse_hm(&end_time);

        let now_mins = now_h * 60 + now_m;
        let start_mins = start_h * 60 + start_m;
        let end_mins = end_h * 60 + end_m;

        let in_quiet_hours = if start_mins <= end_mins {
            now_mins >= start_mins && now_mins < end_mins
        } else {
            // Over midnight (e.g. 22:00 to 08:00)
            now_mins >= start_mins || now_mins < end_mins
        };

        if in_quiet_hours {
            return Ok(false);
        }
    }

    // 4. Duplicate suppression: Check if same title and topic were sent within min_interval_secs
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notification_logs
             WHERE topic = ?1 AND title = ?2
             AND (strftime('%s', 'now') - strftime('%s', sent_at)) < ?3",
            params![topic, title, min_interval_secs],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(count == 0)
}

pub fn log_notification(
    conn: &Connection,
    topic: &str,
    title: &str,
    body: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO notification_logs (topic, title, body, sent_at)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        params![topic, title, body],
    )
    .map_err(|e| format!("Failed to log notification: {e}"))?;
    Ok(())
}

fn parse_hm(s: &str) -> (i64, i64) {
    let mut parts = s.split(':');
    let h = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let m = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    (h, m)
}

fn chrono_like_now_hm() -> (i64, i64) {
    // Read local or UTC time roughly using system time or fallback
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let day_secs = secs % 86400;
    let hours = (day_secs / 3600) as i64;
    let mins = ((day_secs % 3600) / 60) as i64;
    (hours, mins)
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Breakdown & Cache Management
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageBreakdown {
    pub db_path: String,
    pub file_size_bytes: u64,
    pub file_size_mb: f64,
    pub article_count: i64,
    pub briefing_count: i64,
    pub conversation_count: i64,
    pub message_count: i64,
    pub notification_count: i64,
    pub source_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupResult {
    pub deleted_articles: usize,
    pub deleted_notifications: usize,
    pub freed_bytes: i64,
}

pub fn get_storage_breakdown(conn: &Connection, db_path: &std::path::Path) -> Result<StorageBreakdown, String> {
    let file_size_bytes = std::fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);
    let file_size_mb = (file_size_bytes as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0;

    let article_count: i64 = conn.query_row("SELECT COUNT(*) FROM articles", [], |r| r.get(0)).unwrap_or(0);
    let briefing_count: i64 = conn.query_row("SELECT COUNT(*) FROM briefings", [], |r| r.get(0)).unwrap_or(0);
    let conversation_count: i64 = conn.query_row("SELECT COUNT(*) FROM conversations", [], |r| r.get(0)).unwrap_or(0);
    let message_count: i64 = conn.query_row("SELECT COUNT(*) FROM conversation_messages", [], |r| r.get(0)).unwrap_or(0);
    let notification_count: i64 = conn.query_row("SELECT COUNT(*) FROM notification_logs", [], |r| r.get(0)).unwrap_or(0);
    let source_count: i64 = conn.query_row("SELECT COUNT(*) FROM news_sources", [], |r| r.get(0)).unwrap_or(0);

    Ok(StorageBreakdown {
        db_path: db_path.display().to_string(),
        file_size_bytes,
        file_size_mb,
        article_count,
        briefing_count,
        conversation_count,
        message_count,
        notification_count,
        source_count,
    })
}

pub fn clear_temporary_cache(conn: &Connection, db_path: &std::path::Path) -> Result<CleanupResult, String> {
    let size_before = std::fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);

    let deleted_articles = conn.execute(
        "DELETE FROM articles WHERE fetched_at < datetime('now', '-14 days')",
        [],
    ).map_err(|e| format!("Failed to prune old articles: {e}"))?;

    let deleted_notifications = conn.execute(
        "DELETE FROM notification_logs WHERE sent_at < datetime('now', '-7 days')",
        [],
    ).map_err(|e| format!("Failed to prune old notifications: {e}"))?;

    // Vacuum database to reclaim unused disk space
    conn.execute_batch("VACUUM;").map_err(|e| format!("Failed to vacuum database: {e}"))?;

    let size_after = std::fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);
    let freed_bytes = (size_before as i64) - (size_after as i64);

    Ok(CleanupResult {
        deleted_articles,
        deleted_notifications,
        freed_bytes: if freed_bytes > 0 { freed_bytes } else { 0 },
    })
}

pub fn backup_database(
    conn: &mut Connection,
    source_path: &std::path::Path,
    dest_path_override: Option<&str>,
) -> Result<String, String> {
    let backup_dir = match dest_path_override {
        Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p.trim()),
        _ => source_path.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| std::path::PathBuf::from(".")),
    };

    if !backup_dir.exists() {
        let _ = std::fs::create_dir_all(&backup_dir);
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let backup_filename = format!("nexora_backup_{timestamp}.db");
    let dest_file = backup_dir.join(&backup_filename);

    let mut dest_conn = Connection::open(&dest_file)
        .map_err(|e| format!("Failed to create backup destination database: {e}"))?;

    let backup = rusqlite::backup::Backup::new(conn, &mut dest_conn)
        .map_err(|e| format!("Failed to initialize SQLite online backup: {e}"))?;

    backup.run_to_completion(100, std::time::Duration::from_millis(50), None)
        .map_err(|e| format!("Failed to execute SQLite backup: {e}"))?;

    Ok(dest_file.display().to_string())
}

pub fn restore_database(
    conn: &mut Connection,
    backup_file_path: &str,
) -> Result<(), String> {
    let b_path = std::path::Path::new(backup_file_path);
    if !b_path.exists() {
        return Err(format!("Backup file does not exist: {backup_file_path}"));
    }

    let backup_conn = Connection::open(b_path)
        .map_err(|e| format!("Cannot open backup file: {e}"))?;

    let check: Result<String, _> = backup_conn.query_row("PRAGMA quick_check", [], |r| r.get(0));
    match check {
        Ok(ref s) if s == "ok" => {},
        _ => return Err("The selected backup file is corrupted or not a valid SQLite database.".to_string()),
    }

    {
        let backup = rusqlite::backup::Backup::new(&backup_conn, conn)
            .map_err(|e| format!("Failed to initialize restore backup process: {e}"))?;

        backup.run_to_completion(100, std::time::Duration::from_millis(50), None)
            .map_err(|e| format!("Failed to restore database from backup: {e}"))?;
    }
    drop(backup_conn);

    crate::db::connection::configure_pragmas(conn)?;

    Ok(())
}
