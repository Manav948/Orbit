//! AI Intelligence Engine: Summarization, Story Grouping, Briefings, RAG Q&A, and Personal Assistant.
//!
//! Orchestrates article processing, structured 5-part intelligence generation,
//! conversational follow-up questions with source grounding, multi-turn assistant chat, and daily briefings.
//! All database locks are acquired only for brief queries/inserts and released before
//! network calls to ensure non-blocking, responsive concurrency.

use serde::{Deserialize, Serialize};

use crate::ai::client::{
    get_active_provider, get_provider_api_key, get_provider_model,
    send_chat_completion_with_provider, send_conversation_completion,
    send_groq_responses_with_web_search, AiProvider, ChatMessage, WebCitation,
};
use crate::ai::clustering::{cluster_articles, tokenize, RawCluster};
use crate::db::repository::{
    add_conversation_message, create_conversation, find_story_cluster_by_hash, get_articles,
    get_conversation, get_conversation_messages, get_story_clusters_with_articles, insert_briefing,
    insert_story_cluster, search_articles_for_question, Article, Briefing,
    NewBriefing, NewStoryCluster, StoryClusterWithArticles,
};
use crate::db::DbState;
use crate::finance::client::{get_finance_config, get_finnhub_key, get_watchlist_quotes};

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
    pub web_sources: Vec<WebCitation>,
    pub market_data_sources: Vec<MarketDataSource>,
    pub model_used: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketDataSource {
    pub symbol: String,
    pub provider: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantReply {
    pub conversation_id: i64,
    pub message_id: i64,
    pub role: String,
    pub content: String,
    pub sources: Vec<Article>,
    pub provider: String,
    pub model: String,
    pub created_at: String,
}

const SYSTEM_ANALYSIS_PROMPT: &str = r#"You are the Orbit Desktop Intelligence Assistant AI engine.
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

const SYSTEM_QUESTION_PROMPT: &str = r#"You are Orbit, an intelligent desktop news assistant.
Answer the user's question with relevant, up-to-date information.

RULES:
1. Use Orbit's verified dispatches, AI story summaries, and live market quotes when they are provided. For current-events questions, also use the web search results available to you.
2. Combine local reporting and web information when both are useful. Clearly distinguish local dispatches from web reporting, and cite publishers or organizations by name.
3. Treat only explicitly identified live quotes as live. Never invent prices, dates, events, or citations. If no reliable source supports an answer, say what is missing.
4. Answer the exact question directly. For broad news summaries, synthesize the major developments across topics instead of focusing on a single article.
5. Write natural, clear prose. Do not output Markdown tables, pipe-separated rows, raw HTML, literal <br> tags, or decorative Markdown such as **. Use short paragraphs and a few bullets only when useful.
6. Output valid JSON:
{
  "answer": "A concise, direct answer in clear plain-language prose.",
  "simple_explanation": "A beginner-friendly explanation in clear plain-language prose.",
  "decision_explanation": "A concise strategic takeaway or useful metric to watch."
}"#;

const SYSTEM_QUESTION_WEB_PROMPT: &str = r#"You are Orbit, an intelligent desktop news assistant.
Answer the user's question using relevant Orbit dispatches, AI story summaries, and live market quotes provided in context. For questions about current or recent news, trending subjects, market movements, or today's events, use browser_search before answering. Timeless general questions do not require a search.
Combine local reporting and web information when both are useful, and distinguish between them. Cite source names in natural prose. Never invent facts or market prices. Use clear, concise plain-language paragraphs or a short bullet list when useful.
Do not output JSON, Markdown tables, raw HTML, or decorative Markdown. Return only the answer text."#;

const SYSTEM_ASSISTANT_PROMPT: &str = r#"You are Orbit, a personal AI desktop assistant.
You help users with questions, news briefings, analysis of current events, technology/AI advancements, and financial markets.

GUIDELINES:
1. When answering questions regarding recent news, companies, or events, prioritize any provided verified news dispatches and cite publishers.
2. Clearly distinguish between verified facts from news reports and speculative analysis or AI general knowledge.
3. If asked for financial advice, provide objective market data and context, but explicitly clarify that you do not offer personalized investment recommendations.
4. Be concise, direct, helpful, and objective. Use natural paragraphs and occasional simple bullets when useful. Never output raw HTML or Markdown tables."#;

/// Process raw articles from SQLite into structured AI story intelligence.
pub async fn process_news_intelligence(
    db: &DbState,
    category: Option<&str>,
    limit: u32,
    force_refresh: bool,
) -> Result<Vec<StoryClusterWithArticles>, String> {
    // 1. Fetch recent articles from SQLite (brief lock)
    let (articles, provider, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let arts = get_articles(&conn, category, limit.clamp(10, 80))?;
        let prov = get_active_provider(&conn);
        let key = get_provider_api_key(&conn, prov);
        let mdl = get_provider_model(&conn, prov);
        (arts, prov, key, mdl)
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
            // Call AI provider with structured JSON output (no lock held during HTTP call!)
            match send_chat_completion_with_provider(
                provider,
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

        // Save cluster to SQLite (brief lock)
        let new_cluster = NewStoryCluster {
            cluster_hash: cluster.cluster_hash.clone(),
            category: cluster.category.clone(),
            title: analysis.title,
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

        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let _ = insert_story_cluster(&conn, &new_cluster, &article_ids);
    }

    // Return the clusters with articles
    let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    get_story_clusters_with_articles(&conn, category, None, None, 10)
}

fn generate_heuristic_fallback(cluster: &RawCluster) -> StructuredAnalysis {
    let primary = &cluster.articles[0];
    let headline = primary.title.clone();
    let publisher = primary.publisher.as_deref().unwrap_or("News Wire");
    let desc = primary.description.as_deref().unwrap_or("Ongoing developments reported.");

    StructuredAnalysis {
        title: headline.clone(),
        what_happened: format!("{desc} Reported by {publisher}."),
        why_it_happened: format!(
            "Emerging report covered across {} corroborated source dispatch(es). Full contextual causes pending deeper verification.",
            cluster.articles.len()
        ),
        why_it_matters: format!(
            "Pertains to developments in {} with potential sector-wide implications.",
            cluster.category
        ),
        what_happens_next: "Subsequent statements and updates expected as developments unfold.".to_string(),
        what_is_uncertain: "Exact timeline, downstream impacts, and official confirmations are still developing.".to_string(),
        simple_summary: format!("{headline}: {desc}"),
        detailed_summary: format!(
            "This story is corroborated by {}.\n\nContext: {}\n\nFurther dispatches will be synchronized in upcoming briefings.",
            publisher, desc
        ),
        decision_summary: format!(
            "Monitor {} signals regarding {}.",
            cluster.category, headline
        ),
    }
}

/// Generate a daily briefing across recent news articles.
pub async fn generate_briefing(
    db: &DbState,
    briefing_type: &str,
    briefing_length: &str,
) -> Result<Briefing, String> {
    let category_filter = match briefing_type {
        "world" => Some("world"),
        "technology" => Some("technology"),
        "finance" => Some("finance"),
        _ => None,
    };

    let (articles, provider, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let arts = get_articles(&conn, category_filter, 20)?;
        let prov = get_active_provider(&conn);
        let key = get_provider_api_key(&conn, prov);
        let mdl = get_provider_model(&conn, prov);
        (arts, prov, key, mdl)
    };

    if articles.is_empty() {
        return Err("No articles found in database to compile briefing. Please sync news feeds first.".to_string());
    }

    let mut context_summary = String::new();
    for (i, art) in articles.iter().take(12).enumerate() {
        context_summary.push_str(&format!(
            "[{}] ({}) {}\n{}\n\n",
            i + 1,
            art.publisher.as_deref().unwrap_or("Wire"),
            art.title,
            art.description.as_deref().unwrap_or("")
        ));
    }

    let length_instruction = match briefing_length {
        "short" => "Keep the briefing concise (approximately 2 minutes reading time, around 200 words). Use bullet points.",
        "detailed" => "Provide an in-depth executive briefing (around 500-700 words) with detailed background, implications, and bullet points.",
        _ => "Provide a balanced, structured briefing (around 350-400 words) with key developments, strategic impact, and key takeaways.",
    };

    let system_prompt = format!(
        "You are the Orbit Desktop Intelligence Assistant. Write a clear, polished briefing for a person reading a chat message.\n\
         Start directly with the briefing; do not add an introduction about compiling, synthesis, preview mode, or article counts.\n\
         Use concise section headings, short paragraphs, and bullets only where they improve readability. Do not number every story.\n\
         Cite publishers naturally in the relevant sentence. Avoid markdown heading markers, repetitive labels, and filler.\n\
         {length_instruction}\n\
         Ground every claim in the provided articles and never invent facts."
    );

    let user_prompt = format!(
        "Write a {} briefing using the dispatches below. Return only the finished reader-facing briefing.\n\nDispatches:\n{}",
        briefing_type.to_uppercase(),
        context_summary
    );

    let summary = if let Some(ref key) = api_key {
        send_chat_completion_with_provider(
            provider,
            key,
            &model,
            &system_prompt,
            &user_prompt,
            false,
            Some(1200),
        )
        .await
        .unwrap_or_else(|_| {
            format!(
                "Executive Briefing ({briefing_type}): Compiled from {} articles.\n\nKey highlights:\n- {}",
                articles.len(),
                articles
                    .iter()
                    .take(4)
                    .map(|a| a.title.as_str())
                    .collect::<Vec<_>>()
                    .join("\n- ")
            )
        })
    } else {
        format!(
            "Executive Briefing ({briefing_type}) [Preview Mode]:\n\nRecent Top Dispatches:\n- {}",
            articles
                .iter()
                .take(5)
                .map(|a| format!("{} ({})", a.title, a.publisher.as_deref().unwrap_or("Wire")))
                .collect::<Vec<_>>()
                .join("\n- ")
        )
    };

    let title = format!(
        "{} Briefing ({})",
        match briefing_type {
            "morning" => "Morning Executive",
            "overnight" => "Overnight Intelligence",
            "technology" => "Technology & AI",
            "finance" => "Financial Markets",
            "world" => "World Affairs",
            _ => "Executive News",
        },
        match briefing_length {
            "short" => "Quick 2m",
            "detailed" => "Deep 10m",
            _ => "Standard 5m",
        }
    );

    let new_briefing = NewBriefing {
        title,
        summary,
        category: category_filter.unwrap_or("all").to_string(),
        briefing_type: Some(briefing_type.to_string()),
        briefing_length: Some(briefing_length.to_string()),
        model_used: Some(if api_key.is_some() { model } else { "heuristic-preview".to_string() }),
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

fn parse_qna_response(content: &str) -> Result<QnAResponse, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("Orbit received an empty answer.".to_string());
    }
    if let Ok(response) = serde_json::from_str::<QnAResponse>(trimmed) {
        return Ok(response);
    }

    let json_candidate = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .map(|candidate| candidate.strip_suffix("```").unwrap_or(candidate).trim())
        .unwrap_or(trimmed);
    if json_candidate.starts_with('{') {
        return serde_json::from_str::<QnAResponse>(json_candidate)
            .map_err(|error| format!("Orbit received an unreadable answer: {error}"));
    }

    Ok(QnAResponse {
        answer: trimmed.to_string(),
        simple_explanation: None,
        decision_explanation: None,
    })
}

fn is_broad_overview_question(question: &str) -> bool {
    let question = question.to_lowercase();
    [
        "summarize everything",
        "summarise everything",
        "summarize all",
        "summarise all",
        "what is happening",
        "what's happening",
        "what is going on",
        "what's going on",
        "latest news",
        "trending news",
        "what's trending",
        "what is trending",
        "top stories",
        "news overview",
        "give me an overview",
        "brief me",
    ]
    .iter()
    .any(|phrase| question.contains(phrase))
}

fn is_market_question(question: &str) -> bool {
    let question = question.to_lowercase();
    [
        "market",
        "stock",
        "finance",
        "financial",
        "crypto",
        "bitcoin",
        "trading",
        "economy",
        "economic",
        "share price",
        "watchlist",
    ]
    .iter()
    .any(|phrase| question.contains(phrase))
}

fn truncate_context(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

/// Answer from Orbit's local reporting and, when supported, current web search.
pub async fn ask_question(
    db: &DbState,
    question: &str,
    story_context: Option<&str>,
) -> Result<AiAnswer, String> {
    let question_trimmed = question.trim();
    if question_trimmed.is_empty() {
        return Err("Please enter a question to ask Orbit.".to_string());
    }

    let tokens = tokenize(question_trimmed);
    let token_vec: Vec<String> = tokens.into_iter().collect();
    let is_overview = is_broad_overview_question(question_trimmed);
    let include_market_data = is_overview || is_market_question(question_trimmed);

    let (matching_articles, story_clusters, provider, api_key, model, watchlist, finance_key) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let mut arts = search_articles_for_question(&conn, &token_vec, 8)?;
        let mut story_clusters = Vec::new();
        if is_overview {
            let recent_articles = get_articles(&conn, None, 14)?;
            let mut article_ids: std::collections::HashSet<i64> =
                arts.iter().map(|article| article.id).collect();
            for article in recent_articles {
                if article_ids.insert(article.id) {
                    arts.push(article);
                }
            }

            story_clusters = get_story_clusters_with_articles(&conn, None, None, None, 8)?;
            for story in &story_clusters {
                for article in &story.articles {
                    if article_ids.insert(article.id) {
                        arts.push(article.clone());
                    }
                }
            }
        }
        arts.truncate(18);
        let prov = get_active_provider(&conn);
        let key = get_provider_api_key(&conn, prov);
        let mdl = get_provider_model(&conn, prov);
        let finance_config = get_finance_config(&conn);
        let finnhub_key = get_finnhub_key(&conn);
        (
            arts,
            story_clusters,
            prov,
            key,
            mdl,
            finance_config.watchlist,
            finnhub_key,
        )
    };

    let quotes = if include_market_data && !watchlist.is_empty() {
        let symbols = watchlist.into_iter().take(5).collect::<Vec<_>>();
        match tokio::time::timeout(
            std::time::Duration::from_secs(3),
            get_watchlist_quotes(finance_key.as_deref(), &symbols),
        )
        .await
        {
            Ok(Ok(quotes)) => quotes
                .into_iter()
                .filter(|quote| quote.provider != "Sample Market Data")
                .collect::<Vec<_>>(),
            Ok(Err(error)) => {
                eprintln!("[Orbit AI] Could not fetch live market context: {error}");
                Vec::new()
            }
            Err(_) => {
                eprintln!("[Orbit AI] Live market context request timed out.");
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };
    let market_data_sources = quotes
        .iter()
        .map(|quote| MarketDataSource {
            symbol: quote.symbol.clone(),
            provider: quote.provider.clone(),
            timestamp: quote.timestamp.clone(),
        })
        .collect::<Vec<_>>();

    let has_web_search = provider == AiProvider::Groq && api_key.is_some();
    if matching_articles.is_empty()
        && story_context.is_none()
        && !has_web_search
        && market_data_sources.is_empty()
    {
        return Ok(AiAnswer {
            question: question_trimmed.to_string(),
            answer: format!(
                "I couldn't find verified dispatches about \"{}\" in Orbit's local feed, and web search isn't available for the configured AI provider. Refresh your feeds or configure Groq to include current web sources.",
                question_trimmed
            ),
            simple_explanation: Some("There are no matching local reports, and live web search is not enabled.".to_string()),
            decision_explanation: Some("Refresh Orbit's news feeds or configure Groq for current web search.".to_string()),
            sources: Vec::new(),
            web_sources: Vec::new(),
            market_data_sources,
            model_used: "local-grounding-check".to_string(),
            created_at: "Just now".to_string(),
        });
    }

    let mut context_text = String::new();
    if let Some(ctx) = story_context {
        context_text.push_str(&format!("[Selected Story Focus]\n{}\n\n", ctx));
    }
    for (i, story) in story_clusters.iter().enumerate() {
        context_text.push_str(&format!(
            "[Orbit AI Story {} | Category: {}]\nTitle: {}\nWhat happened: {}\nWhy it matters: {}\nWhat happens next: {}\n\n",
            i + 1,
            story.cluster.category,
            truncate_context(&story.cluster.title, 220),
            truncate_context(&story.cluster.what_happened, 500),
            truncate_context(&story.cluster.why_it_matters, 400),
            truncate_context(&story.cluster.what_happens_next, 300),
        ));
    }
    for (i, art) in matching_articles.iter().enumerate() {
        context_text.push_str(&format!(
            "[{}] Title: {}\nPublisher: {}\nSummary: {}\nPublished: {}\nURL: {}\n\n",
            i + 1,
            truncate_context(&art.title, 240),
            art.publisher.as_deref().unwrap_or("Wire"),
            truncate_context(art.description.as_deref().unwrap_or(""), 600),
            art.published_at.as_deref().unwrap_or("Recent"),
            art.article_url
        ));
    }
    if !quotes.is_empty() {
        context_text.push_str("[Live Market Watchlist Quotes]\n");
        for quote in &quotes {
            context_text.push_str(&format!(
                "{} ({}) is {:.2}, change {:.2} ({:.2}%). Source: {}. Timestamp: {}.\n",
                quote.symbol,
                quote.name,
                quote.price,
                quote.change,
                quote.change_percent,
                quote.provider,
                quote.timestamp,
            ));
        }
        context_text.push('\n');
    }

    if let Some(ref key) = api_key {
        let user_prompt = format!(
            "User Question: \"{}\"\n\nOrbit Local News, Story, and Market Context:\n{}",
            question_trimmed, context_text
        );

        let (json_str, web_sources) = if provider == AiProvider::Groq {
            let response = send_groq_responses_with_web_search(
                key,
                &model,
                SYSTEM_QUESTION_WEB_PROMPT,
                &user_prompt,
                false,
                Some(2048),
            )
            .await
            .map_err(|error| {
                eprintln!("[Orbit AI] Error in Q&A web search: {error}");
                error
            })?;
            (response.text, response.citations)
        } else {
            let response = send_chat_completion_with_provider(
                provider,
                key,
                &model,
                SYSTEM_QUESTION_PROMPT,
                &user_prompt,
                true,
                Some(1200),
            )
            .await
            .map_err(|error| {
                eprintln!("[Orbit AI] Error in Q&A completion: {error}");
                error
            })?;
            (response, Vec::new())
        };

        let parsed = parse_qna_response(&json_str)
            .map_err(|error| format!("{error} (model: {model})"))?;
        return Ok(AiAnswer {
            question: question_trimmed.to_string(),
            answer: parsed.answer,
            simple_explanation: parsed.simple_explanation,
            decision_explanation: parsed.decision_explanation,
            sources: matching_articles,
            web_sources,
            market_data_sources,
            model_used: model,
            created_at: "Just now".to_string(),
        });
    }

    let primary = if !matching_articles.is_empty() {
        Some(&matching_articles[0])
    } else {
        None
    };

    if primary.is_none() && !quotes.is_empty() {
        let market_summary = quotes
            .iter()
            .map(|quote| {
                format!(
                    "{}: {:.2}, {} {:.2} ({:.2}%)",
                    quote.symbol,
                    quote.price,
                    if quote.change >= 0.0 { "up" } else { "down" },
                    quote.change.abs(),
                    quote.change_percent,
                )
            })
            .collect::<Vec<_>>()
            .join("; ");
        return Ok(AiAnswer {
            question: question_trimmed.to_string(),
            answer: format!("Live watchlist quotes: {market_summary}. These are market snapshots, not investment advice."),
            simple_explanation: Some(format!("Current quotes are available for {} watchlist symbols.", quotes.len())),
            decision_explanation: Some("Check the quote timestamps and provider before making decisions.".to_string()),
            sources: matching_articles,
            web_sources: Vec::new(),
            market_data_sources,
            model_used: "local-market-data".to_string(),
            created_at: "Just now".to_string(),
        });
    }

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
        web_sources: Vec::new(),
        market_data_sources,
        model_used: "local-heuristic".to_string(),
        created_at: "Just now".to_string(),
    })
}

/// Multi-turn conversational personal assistant.
pub async fn assistant_chat(
    db: &DbState,
    conversation_id: Option<i64>,
    user_message: &str,
) -> Result<AssistantReply, String> {
    let msg_trimmed = user_message.trim();
    if msg_trimmed.is_empty() {
        return Err("Please enter a message.".to_string());
    }

    let (cid, history, provider, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let prov = get_active_provider(&conn);
        let key = get_provider_api_key(&conn, prov);
        let mdl = get_provider_model(&conn, prov);

        let active_cid = match conversation_id {
            Some(id) if get_conversation(&conn, id)?.is_some() => id,
            _ => {
                // Generate a short title from the first ~6 words of the message
                let words: Vec<&str> = msg_trimmed.split_whitespace().take(6).collect();
                let title = words.join(" ");
                let safe_title = if title.is_empty() { "New Conversation".to_string() } else { title };
                create_conversation(&conn, &safe_title, prov.as_str(), &mdl)?
            }
        };

        // Record user message
        let _ = add_conversation_message(&conn, active_cid, "user", msg_trimmed, None)?;

        // Retrieve last 10 messages for context
        let msgs = get_conversation_messages(&conn, active_cid)?;
        (active_cid, msgs, prov, key, mdl)
    };

    // Grounding: search SQLite for relevant news articles if message references current events/news
    let tokens = tokenize(msg_trimmed);
    let token_vec: Vec<String> = tokens.into_iter().collect();
    let matching_articles = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        search_articles_for_question(&conn, &token_vec, 4).unwrap_or_default()
    };

    let mut system_context = SYSTEM_ASSISTANT_PROMPT.to_string();
    if !matching_articles.is_empty() {
        system_context.push_str("\n\n--- RELEVANT DISPATCHES IN LOCAL DATABASE ---\n");
        for art in &matching_articles {
            system_context.push_str(&format!(
                "- [{}] {}: {}\n",
                art.publisher.as_deref().unwrap_or("Wire"),
                art.title,
                art.description.as_deref().unwrap_or("")
            ));
        }
        system_context.push_str("----------------------------------------------\n");
    }

    let mut chat_messages: Vec<ChatMessage> = Vec::new();
    chat_messages.push(ChatMessage {
        role: "system".to_string(),
        content: system_context,
    });

    for msg in history.iter().rev().take(8).rev() {
        chat_messages.push(ChatMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    let (assistant_text, final_model) = if let Some(ref key) = api_key {
        match send_conversation_completion(provider, key, &model, chat_messages, Some(1200)).await {
            Ok(reply) => (reply, model.clone()),
            Err(e) => (
                format!("**[{} Response Error]** {}\n\n*Falling back to local intelligence mode.*", provider.display_name(), e),
                "error-fallback".to_string(),
            ),
        }
    } else {
        (
            "Connect an AI provider in Settings AI Configuration to get an answer.".to_string(),
            "local-preview".to_string(),
        )
    };

    // Store sources in JSON if present
    let sources_json = if !matching_articles.is_empty() {
        serde_json::to_string(&matching_articles).ok()
    } else {
        None
    };

    let msg_id = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        add_conversation_message(&conn, cid, "assistant", &assistant_text, sources_json.as_deref())?
    };

    Ok(AssistantReply {
        conversation_id: cid,
        message_id: msg_id,
        role: "assistant".to_string(),
        content: assistant_text,
        sources: matching_articles,
        provider: provider.as_str().to_string(),
        model: final_model,
        created_at: "Just now".to_string(),
    })
}

/// Test connection to specified or active AI provider.
pub async fn test_provider_connection(
    db: &DbState,
    provider_override: Option<&str>,
) -> Result<String, String> {
    let (provider, key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let prov = provider_override
            .map(AiProvider::from_str_name)
            .unwrap_or_else(|| get_active_provider(&conn));
        let k = get_provider_api_key(&conn, prov).ok_or_else(|| {
            format!(
                "No API key found for {}. Please enter an API key in Settings > AI Configuration or set the corresponding environment variable.",
                prov.display_name()
            )
        })?;
        let m = get_provider_model(&conn, prov);
        (prov, k, m)
    };

    let system_prompt = "You are an API diagnostic tester. Respond with a short confirmation.";
    let user_prompt = "Ping test. Please reply 'Pong: Orbit Intelligence Connected'.";

    let response = send_chat_completion_with_provider(
        provider,
        &key,
        &model,
        system_prompt,
        user_prompt,
        false,
        Some(30),
    )
    .await?;

    Ok(format!(
        "Connected to {} ({}) successfully. Response: {}",
        provider.display_name(),
        model,
        response.trim()
    ))
}

/// Backwards compatible test_ai_connection.
pub async fn test_ai_connection(db: &DbState) -> Result<String, String> {
    test_provider_connection(db, None).await
}
