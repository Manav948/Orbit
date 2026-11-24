//! Asynchronous RSS & Atom Feed Fetcher.

use std::time::Duration;
use reqwest::header::{HeaderMap, HeaderValue, IF_MODIFIED_SINCE, IF_NONE_MATCH, USER_AGENT};
use serde::{Deserialize, Serialize};

use crate::news::categorizer::categorize_article;
use crate::news::normalizer::{clean_html_summary, generate_content_hash, normalize_url};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchedArticleItem {
    pub title: String,
    pub description: Option<String>,
    pub article_url: String,
    pub publisher: String,
    pub category: String,
    pub published_at: Option<String>,
    pub guid: Option<String>,
    pub content_hash: String,
}

#[derive(Debug)]
pub enum FeedFetchResult {
    /// Feed was modified and returned new items.
    Success {
        items: Vec<FetchedArticleItem>,
        etag: Option<String>,
        last_modified: Option<String>,
    },
    /// HTTP 304: Feed has not changed since last fetch.
    NotModified,
    /// Network or parse error (handled gracefully).
    Error(String),
}

/// Fetches and parses an RSS or Atom feed with timeout and conditional ETag/Last-Modified support.
pub async fn fetch_feed(
    client: &reqwest::Client,
    feed_url: &str,
    publisher_name: &str,
    default_category: &str,
    etag: Option<&str>,
    last_modified: Option<&str>,
) -> FeedFetchResult {
    let mut headers = HeaderMap::new();

    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OrbitNews/1.0"),
    );

    if let Some(tag) = etag {
        if let Ok(val) = HeaderValue::from_str(tag) {
            headers.insert(IF_NONE_MATCH, val);
        }
    }

    if let Some(lm) = last_modified {
        if let Ok(val) = HeaderValue::from_str(lm) {
            headers.insert(IF_MODIFIED_SINCE, val);
        }
    }

    let response = match client
        .get(feed_url)
        .headers(headers)
        .timeout(Duration::from_secs(12))
        .send()
        .await
    {
        Ok(res) => res,
        Err(err) => {
            return FeedFetchResult::Error(format!("Network request failed: {err}"));
        }
    };

    // Handle HTTP 304 Not Modified
    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        return FeedFetchResult::NotModified;
    }

    if !response.status().is_success() {
        return FeedFetchResult::Error(format!("Server returned HTTP {}", response.status()));
    }

    // Capture response caching headers for future conditional requests
    let new_etag = response
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    let new_last_modified = response
        .headers()
        .get(reqwest::header::LAST_MODIFIED)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Read response body as bytes
    let body_bytes = match response.bytes().await {
        Ok(b) => b,
        Err(err) => return FeedFetchResult::Error(format!("Failed to read response body: {err}")),
    };

    // Parse RSS 0.9/2.0 or Atom feed using feed-rs
    let parsed_feed = match feed_rs::parser::parse(&body_bytes[..]) {
        Ok(feed) => feed,
        Err(err) => return FeedFetchResult::Error(format!("Feed XML parse error: {err}")),
    };

    let mut items = Vec::new();

    for entry in parsed_feed.entries {
        // Extract title
        let title = match entry.title {
            Some(t) => clean_html_summary(&t.content),
            None => continue, // Skip articles without a title
        };

        if title.trim().is_empty() {
            continue;
        }

        // Extract primary link
        let raw_link = entry
            .links
            .iter()
            .find(|l| l.rel.as_deref().unwrap_or("alternate") == "alternate" || l.rel.is_none())
            .map(|l| l.href.clone())
            .or_else(|| entry.links.first().map(|l| l.href.clone()));

        let Some(article_url) = raw_link else {
            continue; // Skip items without link
        };

        let normalized_link = normalize_url(&article_url);
        if normalized_link.is_empty() {
            continue;
        }

        // Extract summary / description
        let raw_desc = entry
            .summary
            .map(|s| s.content)
            .or_else(|| entry.content.and_then(|c| c.body));

        let clean_desc = raw_desc.map(|d| {
            let stripped = clean_html_summary(&d);
            // Cap description at 400 characters to keep database lightweight
            if stripped.chars().count() > 400 {
                let mut truncated: String = stripped.chars().take(400).collect();
                truncated.push_str("...");
                truncated
            } else {
                stripped
            }
        });

        // Extract publication timestamp (RFC 3339)
        let published_at = entry
            .published
            .or(entry.updated)
            .map(|dt| dt.to_rfc3339());

        let guid = Some(entry.id);
        let content_hash = generate_content_hash(&title, publisher_name);
        let category = categorize_article(
            default_category,
            &title,
            clean_desc.as_deref().unwrap_or(""),
        );

        items.push(FetchedArticleItem {
            title,
            description: clean_desc,
            article_url: normalized_link,
            publisher: publisher_name.to_string(),
            category,
            published_at,
            guid,
            content_hash,
        });
    }

    FeedFetchResult::Success {
        items,
        etag: new_etag,
        last_modified: new_last_modified,
    }
}

