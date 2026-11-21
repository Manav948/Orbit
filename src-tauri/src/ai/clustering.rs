//! News clustering, grouping, and importance scoring.
//!
//! Groups raw articles covering the same real-world event into clusters
//! to avoid processing duplicate stories, minimize OpenAI API calls,
//! and calculate cross-publisher importance metrics.

use std::collections::HashSet;
use crate::db::repository::Article;

/// Stop words excluded from article title similarity comparison.
static STOP_WORDS: &[&str] = &[
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
    "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
    "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
    "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
    "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
    "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
    "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
    "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
    "yours", "yourself", "yourselves", "says", "said", "new", "amid", "will", "over", "after",
];

/// High-impact keywords that elevate story importance.
static IMPACT_KEYWORDS: &[&str] = &[
    "breaking", "record", "crisis", "surge", "surges", "plunge", "plunges", "announces", "announced",
    "investigation", "war", "conflict", "ceasefire", "rate", "fed", "inflation", "earnings",
    "acquisition", "merger", "unveils", "breakthrough", "sanctions", "lawsuit", "verdict",
    "emergency", "resigns", "ai", "openai", "google", "apple", "nvidia", "microsoft", "threat",
    "vulnerability", "hack", "cyberattack", "zero-day",
];

#[derive(Debug, Clone)]
pub struct RawCluster {
    pub cluster_hash: String,
    pub category: String,
    pub primary_title: String,
    pub articles: Vec<Article>,
    pub importance_score: i64,
    pub distinct_publishers: Vec<String>,
}

/// Tokenize text into normalized significant word tokens.
pub fn tokenize(text: &str) -> HashSet<String> {
    let stop_set: HashSet<&str> = STOP_WORDS.iter().copied().collect();
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 3 && !stop_set.contains(*w))
        .map(|w| w.to_string())
        .collect()
}

/// Calculate Jaccard similarity between two token sets.
fn jaccard_similarity(a: &HashSet<String>, b: &HashSet<String>) -> f32 {
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let intersection = a.intersection(b).count();
    let union = a.union(b).count();
    intersection as f32 / union as f32
}

/// Check if two articles likely describe the exact same event.
fn are_articles_related(
    art1: &Article,
    tokens1: &HashSet<String>,
    art2: &Article,
    tokens2: &HashSet<String>,
) -> bool {
    // 1. Same category is preferred or strong match across general/world
    let same_or_related_cat = art1.category == art2.category
        || (art1.category == "world" && art2.category == "business")
        || (art1.category == "technology" && art2.category == "ai");

    if !same_or_related_cat {
        return false;
    }

    // 2. Compute token overlap on titles
    let sim = jaccard_similarity(tokens1, tokens2);
    let common_tokens = tokens1.intersection(tokens2).count();

    // Either high Jaccard similarity or 3+ exact matching key topic words
    sim >= 0.28 || common_tokens >= 3
}

/// Calculate importance score (1 to 99) for a group of articles.
fn calculate_importance_score(articles: &[Article], primary_tokens: &HashSet<String>) -> i64 {
    let mut score = 45;

    // Multi-publisher corroboration: +15 for each additional distinct publisher
    let mut publishers: HashSet<String> = HashSet::new();
    for art in articles {
        if let Some(ref pub_name) = art.publisher {
            publishers.insert(pub_name.to_lowercase());
        }
    }
    let distinct_count = publishers.len();
    if distinct_count > 1 {
        score += ((distinct_count - 1) as i64) * 15;
    }

    // Impact keywords boost
    for kw in IMPACT_KEYWORDS {
        if primary_tokens.contains(*kw) {
            score += 6;
        }
    }

    score.clamp(20, 98)
}

/// Compute a deterministic cluster hash from the sorted URLs of the articles.
fn compute_cluster_hash(articles: &[Article]) -> String {
    use std::collections::BTreeSet;
    let mut urls = BTreeSet::new();
    for a in articles {
        urls.insert(&a.article_url);
    }
    let concatenated = urls.into_iter().cloned().collect::<Vec<_>>().join("|");

    // Simple robust hash representation
    format!("{:x}", calculate_hash_val(&concatenated))
}

fn calculate_hash_val(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

/// Group raw articles into topic clusters with importance scores and deduplication.
pub fn cluster_articles(articles: &[Article]) -> Vec<RawCluster> {
    if articles.is_empty() {
        return Vec::new();
    }

    let token_map: Vec<HashSet<String>> = articles
        .iter()
        .map(|a| tokenize(&a.title))
        .collect();

    let mut visited: Vec<bool> = vec![false; articles.len()];
    let mut clusters: Vec<RawCluster> = Vec::new();

    for i in 0..articles.len() {
        if visited[i] {
            continue;
        }

        visited[i] = true;
        let mut group = vec![articles[i].clone()];
        let mut group_tokens = token_map[i].clone();

        for j in (i + 1)..articles.len() {
            if visited[j] {
                continue;
            }

            if are_articles_related(&articles[i], &token_map[i], &articles[j], &token_map[j]) {
                visited[j] = true;
                group.push(articles[j].clone());
                group_tokens.extend(token_map[j].clone());
            }
        }

        let primary_title = group[0].title.clone();
        let category = group[0].category.clone();
        let score = calculate_importance_score(&group, &group_tokens);
        let cluster_hash = compute_cluster_hash(&group);

        let mut publishers_set = HashSet::new();
        for a in &group {
            if let Some(ref p) = a.publisher {
                publishers_set.insert(p.clone());
            }
        }
        let distinct_publishers: Vec<String> = publishers_set.into_iter().collect();

        clusters.push(RawCluster {
            cluster_hash,
            category,
            primary_title,
            articles: group,
            importance_score: score,
            distinct_publishers,
        });
    }

    // Sort clusters by importance score descending
    clusters.sort_by(|a, b| b.importance_score.cmp(&a.importance_score));
    clusters
}
