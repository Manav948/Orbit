//! AI Intelligence Engine: Summarization, Story Grouping, Briefings, and RAG Q&A.
//!
//! Orchestrates article processing, structured 5-part intelligence generation,
//! conversational follow-up questions with source grounding, and daily briefings.
//! All database locks are acquired only for brief queries/inserts and released before
//! network calls to ensure non-blocking, responsive concurrency.

use serde::{Deserialize, Serialize};

use crate::ai::client::{get_api_key, get_model, send_chat_completion};
use crate::ai::clustering::{cluster_articles, tokenize, RawCluster};
use crate::db::repository::{
    find_story_cluster_by_hash, get_articles, get_story_clusters_with_articles,
    insert_briefing, insert_story_cluster, search_articles_for_question, Article,
    Briefing, NewBriefing, NewStoryCluster, StoryClusterWithArticles,
};
use crate::db::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredAnalysis {
    pub title: String,
    pub what_happened: String,
    pub why_it_happened: String,
    pub why_it_matters: String,
    pub what_happens_next: String,
    pub what_is_uncertain: String,
    pub simple_summary: String,
    pub detailed_summary: String,
    pub decision_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiAnswer {
    pub question: String,
    pub answer: String,
    pub simple_explanation: Option<String>,
    pub decision_explanation: Option<String>,
    pub sources: Vec<Article>,
    pub model_used: String,
    pub created_at: String,
}

const SYSTEM_ANALYSIS_PROMPT: &str = r#"You are the Nexora Desktop Intelligence Assistant AI engine.
Transform verified news reporting into clear, structured, actionable intelligence.

STRICT VERIFICATION & FACTUAL INTEGRITY RULES:
1. Base your analysis EXCLUSIVELY on the provided source articles.
2. NEVER invent facts, statistics, quotes, causal claims, or developments not present in the sources.
3. If sources disagree on figures, causes, or outcomes, explicitly describe the disagreement and cite the differing publishers.
4. Distinguish clearly between confirmed facts, official statements, and speculation or anonymous claims.
5. If details about "Why did it happen" or "What happens next" are not reported, explicitly state that they remain unverified or pending further reports.
6. Never provide personalized financial or investment advice.

You must output valid JSON matching this schema:
{
  "title": "Clear, objective headline",
  "what_happened": "2-3 sentence summary in simple English explaining the core event.",
  "why_it_happened": "Reported background, context, and immediate causes reported by sources.",
  "why_it_matters": "Strategic significance, market impact, industry implications, or societal relevance.",
  "what_happens_next": "Upcoming events, deadlines, scheduled decisions, or key signals worth monitoring.",
  "what_is_uncertain": "Unanswered questions, unverified claims, conflicting accounts, or pending official confirmations.",
  "simple_summary": "A 2-3 sentence beginner-friendly explanation suitable for anyone without domain knowledge.",
  "detailed_summary": "Comprehensive analytical overview detailing background, timeline, key actors, and consequences.",
  "decision_summary": "Executive decision intelligence: why this matters to decision-makers, potential second-order effects, and indicators to watch."
}"#;

const SYSTEM_QUESTION_PROMPT: &str = r#"You are Nexora, an intelligent desktop news assistant.
The user is asking a question about recent developments or current events.
You must answer using ONLY the provided verified news dispatches.

RULES:
1. Answer factually and directly based on the provided dispatches.
2. If the question asks about events not covered in the provided articles, state clearly: "Based on recent dispatches in your feed, there is no verified reporting available on this specific topic."
3. Never guess, assume, or hallucinate current events without source citations.
4. In your answer, cite publishers in parentheses, e.g. (Source: Reuters).
5. Output valid JSON:
{
  "answer": "Direct factual answer grounded strictly in the provided sources.",
  "simple_explanation": "Beginner-friendly breakdown in simple terms.",
  "decision_explanation": "Strategic takeaway or key metric to watch."
}"#;

/// Process raw articles from SQLite into structured AI story intelligence.
pub async fn process_news_intelligence(
    db: &DbState,
    category: Option<&str>,
    limit: u32,
    force_refresh: bool,
) -> Result<Vec<StoryClusterWithArticles>, String> {
    // 1. Fetch recent articles from SQLite (brief lock)
    let (articles, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let arts = get_articles(&conn, category, limit.clamp(10, 80))?;
        let key = get_api_key(&conn);
        let mdl = get_model(&conn);
        (arts, key, mdl)
    };

    if articles.is_empty() {
        return Ok(Vec::new());
    }

    // 2. Cluster articles by real-world event and importance
    let raw_clusters = cluster_articles(&articles);
    let top_clusters: Vec<RawCluster> = raw_clusters.into_iter().take(8).collect();

    for cluster in &top_clusters {
        // Check if this cluster was already analyzed and stored (brief lock)
        if !force_refresh {
            let already_cached = {
                let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
                find_story_cluster_by_hash(&conn, &cluster.cluster_hash).ok().flatten().is_some()
            };
            if already_cached {
                continue;
            }
        }

        // Prepare article summary payload for LLM
        let article_ids: Vec<i64> = cluster.articles.iter().map(|a| a.id).collect();
        let mut prompt_context = String::new();
        for (idx, art) in cluster.articles.iter().enumerate() {
            prompt_context.push_str(&format!(
                "[Dispatch {} | Publisher: {} | Published: {}]\nTitle: {}\nSummary: {}\nURL: {}\n\n",
                idx + 1,
                art.publisher.as_deref().unwrap_or("Unknown Publisher"),
                art.published_at.as_deref().unwrap_or("Recent"),
                art.title,
                art.description.as_deref().unwrap_or("No summary provided."),
                art.article_url
            ));
        }

        let user_prompt = format!(
            "Analyze the following related news dispatches and generate structured intelligence:\n\n{prompt_context}"
        );

        let (analysis, model_used) = if let Some(ref key) = api_key {
            // Call official OpenAI API with structured JSON output (no lock held during HTTP call!)
            match send_chat_completion(
                key,
                &model,
                SYSTEM_ANALYSIS_PROMPT,
                &user_prompt,
                true,
                Some(1500),
            )
            .await
            {
                Ok(json_str) => match serde_json::from_str::<StructuredAnalysis>(&json_str) {
                    Ok(parsed) => (parsed, model.clone()),
                    Err(_) => (generate_heuristic_fallback(cluster), "heuristic-fallback".to_string()),
                },
                Err(_) => (generate_heuristic_fallback(cluster), "heuristic-fallback".to_string()),
            }
        } else {
            // No API key configured: provide clean heuristic extraction
            (generate_heuristic_fallback(cluster), "heuristic-preview".to_string())
        };

        // Save story cluster to SQLite (brief lock)
        let new_cluster = NewStoryCluster {
            cluster_hash: cluster.cluster_hash.clone(),
            category: cluster.category.clone(),
            title: if !analysis.title.trim().is_empty() {
                analysis.title
            } else {
                cluster.primary_title.clone()
            },
            what_happened: analysis.what_happened,
            why_it_happened: analysis.why_it_happened,
            why_it_matters: analysis.why_it_matters,
            what_happens_next: analysis.what_happens_next,
            what_is_uncertain: analysis.what_is_uncertain,
            simple_summary: Some(analysis.simple_summary),
            detailed_summary: Some(analysis.detailed_summary),
            decision_summary: Some(analysis.decision_summary),
            importance_score: cluster.importance_score,
            model_used,
        };

        {
            let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
            let _ = insert_story_cluster(&conn, &new_cluster, &article_ids);
        }
    }

    // Return the latest story clusters with attached source articles
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_story_clusters_with_articles(&conn, category, None, None, 10)
}

/// Fallback extraction when offline or API key is not yet configured.
fn generate_heuristic_fallback(cluster: &RawCluster) -> StructuredAnalysis {
    let primary = &cluster.articles[0];
    let publisher = primary.publisher.as_deref().unwrap_or("Verified Publisher");
    let desc = primary.description.as_deref().unwrap_or("No detailed snippet available.");

    let source_names = cluster.distinct_publishers.join(", ");

    StructuredAnalysis {
        title: primary.title.clone(),
        what_happened: format!(
            "{}. Reported by {}.",
            primary.title,
            if source_names.is_empty() { publisher } else { &source_names }
        ),
        why_it_happened: format!(
            "According to initial reporting from {}: {}",
            publisher, desc
        ),
        why_it_matters: format!(
            "This development in {} is monitored across multiple newsrooms. Cross-publisher coverage indicates notable interest.",
            cluster.category
        ),
        what_happens_next: "Follow live dispatches for ongoing updates, official briefings, and corroborating statements.".to_string(),
        what_is_uncertain: if cluster.distinct_publishers.len() > 1 {
            format!("Reporting corroborated by {} sources. Granular details and second-order impacts remain subject to further official confirmation.", cluster.distinct_publishers.len())
        } else {
            "Single-source report. Awaiting independent corroboration and detailed statements from other major publishers.".to_string()
        },
        simple_summary: format!(
            "In brief: {} (Source: {})",
            primary.title, publisher
        ),
        detailed_summary: format!(
            "Comprehensive reporting from {} indicates: {}. Supporting dispatches continue to update.",
            publisher, desc
        ),
        decision_summary: format!(
            "Strategic indicator: Monitor {} developments for subsequent impacts on regulatory, market, or operational horizons.",
            cluster.category
        ),
    }
}

/// Generate a daily or category-specific intelligence briefing.
pub async fn generate_briefing(
    db: &DbState,
    briefing_type: &str,
    briefing_length: &str,
) -> Result<Briefing, String> {
    let category_filter = match briefing_type {
        "technology" => Some("technology"),
        "finance" => Some("finance"),
        "world" => Some("world"),
        _ => None,
    };

    let (articles, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let arts = get_articles(&conn, category_filter, 25)?;
        let key = get_api_key(&conn);
        let mdl = get_model(&conn);
        (arts, key, mdl)
    };

    if articles.is_empty() {
        return Err("No news articles available to compile a briefing. Please synchronize feeds first.".to_string());
    }

    let target_words = match briefing_length {
        "short" => 300,
        "detailed" => 1300,
        _ => 700,
    };

    let title_prefix = match briefing_type {
        "morning" => "Morning Intelligence Briefing",
        "latest" => "Latest Developments Briefing",
        "overnight" => "Overnight Events Dispatch",
        "technology" => "Technology & AI Executive Briefing",
        "finance" => "Financial & Market Developments",
        "world" => "World Affairs Global Dispatch",
        _ => "Nexora Intelligence Briefing",
    };

    let mut context_text = String::new();
    for (i, art) in articles.iter().take(12).enumerate() {
        context_text.push_str(&format!(
            "{}. [{}] {} - {}\n",
            i + 1,
            art.publisher.as_deref().unwrap_or("Wire"),
            art.title,
            art.description.as_deref().unwrap_or("")
        ));
    }

    let (summary_content, model_used) = if let Some(ref key) = api_key {
        let system_prompt = format!(
            "You are Nexora's Executive Briefing Editor. Create a polished, factual intelligence briefing.\n\
             TARGET LENGTH: ~{target_words} words ({briefing_length} mode).\n\
             FORMAT: Clean markdown with sections: ## Executive Summary, ## Key Developments (cite publishers), and ## Critical Signals to Watch.\n\
             Strictly avoid hallucinated facts or investment advice."
        );
        let user_prompt = format!(
            "Generate a {title_prefix} based on these dispatches:\n\n{context_text}"
        );

        match send_chat_completion(key, &model, &system_prompt, &user_prompt, false, Some(2000)).await {
            Ok(content) => (content, model.clone()),
            Err(e) => {
                let fallback = format!(
                    "## Executive Summary\n\nIntelligence compilation based on {} dispatches across {}.\n\n## Key Developments\n\n{}\n\n*(Note: Live AI synthesis fallback due to: {})*",
                    articles.len(),
                    briefing_type,
                    context_text,
                    e
                );
                (fallback, "heuristic-fallback".to_string())
            }
        }
    } else {
        let fallback = format!(
            "## Executive Summary\n\nAutomated synthesis of {} dispatches compiled locally.\n\n## Key Developments\n\n{}\n\n*(Configure OpenAI API Key in Settings > AI Configuration for rich analytical synthesis)*",
            articles.len(),
            context_text
        );
        (fallback, "local-synthesis".to_string())
    };

    let new_briefing = NewBriefing {
        title: format!("{title_prefix} ({briefing_length})"),
        summary: summary_content,
        category: category_filter.unwrap_or("general").to_string(),
        briefing_type: Some(briefing_type.to_string()),
        briefing_length: Some(briefing_length.to_string()),
        model_used: Some(model_used),
        articles_count: Some(articles.len() as i64),
    };

    let (id, created_at) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let bid = insert_briefing(&conn, &new_briefing)?;
        (bid, "Just now".to_string())
    };

    Ok(Briefing {
        id,
        title: new_briefing.title,
        summary: new_briefing.summary,
        category: new_briefing.category,
        created_at,
        last_updated_at: "Just now".to_string(),
        briefing_type: new_briefing.briefing_type,
        briefing_length: new_briefing.briefing_length,
        model_used: new_briefing.model_used,
        articles_count: new_briefing.articles_count,
    })
}

#[derive(Deserialize)]
struct QnAResponse {
    answer: String,
    simple_explanation: Option<String>,
    decision_explanation: Option<String>,
}

/// Ask a question grounded strictly in local news articles or specific story context.
pub async fn ask_question(
    db: &DbState,
    question: &str,
    story_context: Option<&str>,
) -> Result<AiAnswer, String> {
    let question_trimmed = question.trim();
    if question_trimmed.is_empty() {
        return Err("Please enter a question to ask Nexora.".to_string());
    }

    // Tokenize question to find matching articles in SQLite
    let tokens = tokenize(question_trimmed);
    let token_vec: Vec<String> = tokens.into_iter().collect();

    let (matching_articles, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let arts = search_articles_for_question(&conn, &token_vec, 6)?;
        let key = get_api_key(&conn);
        let mdl = get_model(&conn);
        (arts, key, mdl)
    };

    if matching_articles.is_empty() && story_context.is_none() {
        return Ok(AiAnswer {
            question: question_trimmed.to_string(),
            answer: format!(
                "No verified dispatches regarding \"{}\" were found in your local news feed. Nexora does not speculate or invent current events without source citations. Try refreshing live feeds or asking about recent technology, finance, or world news topics.",
                question_trimmed
            ),
            simple_explanation: Some("No local news records match this question yet.".to_string()),
            decision_explanation: Some("Check live RSS feeds for new dispatches on this subject.".to_string()),
            sources: Vec::new(),
            model_used: "local-grounding-check".to_string(),
            created_at: "Just now".to_string(),
        });
    }

    // Prepare ground truth context
    let mut context_text = String::new();
    if let Some(ctx) = story_context {
        context_text.push_str(&format!("[Selected Story Focus]\n{}\n\n", ctx));
    }
    for (i, art) in matching_articles.iter().enumerate() {
        context_text.push_str(&format!(
            "[{}] Title: {}\nPublisher: {}\nSummary: {}\nPublished: {}\nURL: {}\n\n",
            i + 1,
            art.title,
            art.publisher.as_deref().unwrap_or("Wire"),
            art.description.as_deref().unwrap_or(""),
            art.published_at.as_deref().unwrap_or("Recent"),
            art.article_url
        ));
    }

    if let Some(ref key) = api_key {
        let user_prompt = format!(
            "User Question: \"{}\"\n\nVerified News Context:\n{}",
            question_trimmed, context_text
        );

        match send_chat_completion(
            key,
            &model,
            SYSTEM_QUESTION_PROMPT,
            &user_prompt,
            true,
            Some(1000),
        )
        .await
        {
            Ok(json_str) => {
                if let Ok(parsed) = serde_json::from_str::<QnAResponse>(&json_str) {
                    return Ok(AiAnswer {
                        question: question_trimmed.to_string(),
                        answer: parsed.answer,
                        simple_explanation: parsed.simple_explanation,
                        decision_explanation: parsed.decision_explanation,
                        sources: matching_articles,
                        model_used: model,
                        created_at: "Just now".to_string(),
                    });
                }
            }
            Err(e) => {
                eprintln!("[Nexora AI] Error in Q&A completion: {e}");
            }
        }
    }

    // Local grounded answer if OpenAI call unavailable
    let primary = if !matching_articles.is_empty() {
        Some(&matching_articles[0])
    } else {
        None
    };

    let publisher = primary.and_then(|p| p.publisher.as_deref()).unwrap_or("Verified Wire");
    let title = primary.map(|p| p.title.as_str()).unwrap_or(story_context.unwrap_or("Recent Dispatch"));
    let desc = primary.and_then(|p| p.description.as_deref()).unwrap_or("");

    Ok(AiAnswer {
        question: question_trimmed.to_string(),
        answer: format!(
            "Based on verified dispatches from {}: \"{}\" - {}.",
            publisher, title, desc
        ),
        simple_explanation: Some(format!("The most relevant report is \"{}\" from {}.", title, publisher)),
        decision_explanation: Some("Monitor related developments in subsequent briefings.".to_string()),
        sources: matching_articles,
        model_used: "local-heuristic".to_string(),
        created_at: "Just now".to_string(),
    })
}

/// Test connection to OpenAI API with the configured key.
pub async fn test_ai_connection(db: &DbState) -> Result<String, String> {
    let (key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let k = get_api_key(&conn).ok_or_else(|| {
            "No OpenAI API key found. Please enter your API key in Settings > AI Configuration or set OPENAI_API_KEY.".to_string()
        })?;
        let m = get_model(&conn);
        (k, m)
    };

    let system_prompt = "You are an API diagnostic tester. Respond with a short confirmation.";
    let user_prompt = "Ping test. Please reply 'Pong: Nexora Intelligence Connected'.";

    let response = send_chat_completion(&key, &model, system_prompt, user_prompt, false, Some(30)).await?;
    Ok(format!("Connected to OpenAI ({model}) successfully. Response: {response}"))
}
