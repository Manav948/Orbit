//! URL Normalization, HTML Cleaning, and Content Fingerprinting.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use url::Url;

/// Canonicalizes and strips tracking parameters from article URLs.
pub fn normalize_url(raw_url: &str) -> String {
    let trimmed = raw_url.trim();
    let Ok(mut parsed) = Url::parse(trimmed) else {
        return trimmed.to_string();
    };

    // 1. Lowercase scheme and host
    let scheme = parsed.scheme().to_lowercase();
    let host = parsed.host_str().unwrap_or("").to_lowercase();
    let _ = parsed.set_scheme(&scheme);
    let _ = parsed.set_host(Some(&host));

    // 2. Strip fragment (#...)
    parsed.set_fragment(None);

    // 3. Strip tracking and analytics query parameters
    let tracking_prefixes = [
        "utm_", "fbclid", "gclid", "ga_", "mc_cid", "mc_eid",
        "ref", "source", "sr_share", "ncid", "mbid", "cmpid",
        "_hsenc", "_hsmi", "igshid", "spJobID", "spReportId"
    ];

    let filtered_pairs: Vec<(String, String)> = parsed
        .query_pairs()
        .filter(|(k, _)| {
            let k_lower = k.to_lowercase();
            !tracking_prefixes.iter().any(|prefix| k_lower.starts_with(prefix))
        })
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();

    if filtered_pairs.is_empty() {
        parsed.set_query(None);
    } else {
        let mut serializer = parsed.query_pairs_mut();
        serializer.clear();
        for (k, v) in filtered_pairs {
            serializer.append_pair(&k, &v);
        }
    }

    let mut result = parsed.to_string();

    // 4. Strip trailing slash unless root path
    if result.ends_with('/') && !result.ends_with("://") && result.chars().filter(|&c| c == '/').count() > 3 {
        result.pop();
    }

    result
}

/// Generates a normalized content fingerprint (hash) of title + publisher
/// to detect identical articles syndicated across different mirrors or paths.
pub fn generate_content_hash(title: &str, publisher: &str) -> String {
    let clean_title: String = title
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .to_lowercase();

    let clean_pub = publisher.trim().to_lowercase();

    let mut hasher = DefaultHasher::new();
    clean_title.hash(&mut hasher);
    clean_pub.hash(&mut hasher);

    format!("{:016x}", hasher.finish())
}

/// Strips raw HTML tags from feed descriptions/summaries to ensure clean text preview.
pub fn clean_html_summary(html: &str) -> String {
    let mut in_tag = false;
    let mut clean = String::with_capacity(html.len());

    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                // Add space after tag closure if not already whitespace
                if !clean.ends_with(' ') && !clean.is_empty() {
                    clean.push(' ');
                }
            }
            _ if !in_tag => clean.push(ch),
            _ => {}
        }
    }

    // Collapse multiple consecutive spaces and decode common entities
    clean
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

