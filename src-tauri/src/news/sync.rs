//! Background & Manual Synchronization Engine.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::db::repository::{
    get_enabled_news_sources, insert_articles, update_news_source_sync, NewArticle, NewsSource,
};
use crate::db::DbState;
use crate::news::fetcher::{fetch_feed, FeedFetchResult, FetchedArticleItem};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncReport {
    pub total_sources: usize,
    pub fetched_sources: usize,
    pub new_articles: u64,
    pub errors: Vec<String>,
    pub timestamp: String,
}

/// Orchestrates synchronizing all enabled news feeds concurrently.
pub async fn sync_all_feeds(db: &DbState) -> Result<SyncReport, String> {
    // 1. Get enabled news sources from database
    let sources: Vec<NewsSource> = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        get_enabled_news_sources(&conn)?
    };

    let total_sources = sources.len();
    if total_sources == 0 {
        return Ok(SyncReport {
            total_sources: 0,
            fetched_sources: 0,
            new_articles: 0,
            errors: Vec::new(),
            timestamp: chrono_now(),
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .unwrap_or_default();

    // Limit simultaneous network requests to 4 to keep CPU and network lightweight
    let semaphore = Arc::new(Semaphore::new(4));
    let mut tasks = Vec::new();

    for source in sources {
        let sem = Arc::clone(&semaphore);
        let client_clone = client.clone();
        let s_id = source.id;
        let s_url = source.url.clone();
        let s_name = source.name.clone();
        let s_cat = source.category.clone();
        let s_etag = source.etag.clone();
        let s_lm = source.last_modified.clone();

        tasks.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok();
            let result = fetch_feed(
                &client_clone,
                &s_url,
                &s_name,
                &s_cat,
                s_etag.as_deref(),
                s_lm.as_deref(),
            )
            .await;
            (s_id, s_name, result)
        }));
    }

    let mut all_new_articles: Vec<NewArticle> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut fetched_count = 0;

    for task in tasks {
        if let Ok((source_id, source_name, result)) = task.await {
            match result {
                FeedFetchResult::Success {
                    items,
                    etag,
                    last_modified,
                } => {
                    fetched_count += 1;
                    // Update sync metadata in database
                    if let Ok(conn) = db.0.lock() {
                        let _ = update_news_source_sync(
                            &conn,
                            source_id,
                            etag.as_deref(),
                            last_modified.as_deref(),
                            None,
                        );
                    }

                    for item in items {
                        all_new_articles.push(map_to_new_article(source_id, item));
                    }
                }
                FeedFetchResult::NotModified => {
                    fetched_count += 1;
                    if let Ok(conn) = db.0.lock() {
                        let _ = update_news_source_sync(&conn, source_id, None, None, None);
                    }
                }
                FeedFetchResult::Error(err_msg) => {
                    errors.push(format!("{source_name}: {err_msg}"));
                    if let Ok(conn) = db.0.lock() {
                        let _ = update_news_source_sync(
                            &conn,
                            source_id,
                            None,
                            None,
                            Some(&err_msg),
                        );
                    }
                }
            }
        }
    }

    // 2. Batch insert all new articles with deduplication
    let inserted_count = if !all_new_articles.is_empty() {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        insert_articles(&conn, &all_new_articles)?
    } else {
        0
    };

    Ok(SyncReport {
        total_sources,
        fetched_sources: fetched_count,
        new_articles: inserted_count,
        errors,
        timestamp: chrono_now(),
    })
}

fn map_to_new_article(source_id: i64, item: FetchedArticleItem) -> NewArticle {
    NewArticle {
        title: item.title,
        description: item.description,
        source_id,
        article_url: item.article_url,
        category: item.category,
        published_at: item.published_at,
        publisher: Some(item.publisher),
        guid: item.guid,
        content_hash: Some(item.content_hash),
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

