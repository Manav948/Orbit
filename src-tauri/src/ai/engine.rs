//! AI Intelligence Engine: Summarization, Story Grouping, Briefings, RAG Q&A, and Personal Assistant.
//!
//! Orchestrates article processing, structured 5-part intelligence generation,
//! conversational follow-up questions with source grounding, multi-turn assistant chat, and daily briefings.
//! All database locks are acquired only for brief queries/inserts and released before
//! network calls to ensure non-blocking, responsive concurrency.

use serde::{Deserialize, Serialize};

use crate::ai::client::{
    get_active_provider, get_provider_api_key, get_provider_model, send_chat_completion_with_provider,
    send_conversation_completion, AiProvider, ChatMessage,
};
use crate::ai::clustering::{cluster_articles, tokenize, RawCluster};
use crate::db::repository::{
    add_conversation_message, create_conversation, find_story_cluster_by_hash, get_articles,
    get_conversation, get_conversation_messages, get_story_clusters_with_articles, insert_briefing,
    insert_story_cluster, search_articles_for_question, Article, Briefing,
    NewBriefing, NewStoryCluster, StoryClusterWithArticles,
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

const SYSTEM_ASSISTANT_PROMPT: &str = r#"You are Orbit, a personal AI desktop assistant.
You help users with questions, news briefings, analysis of current events, technology/AI advancements, and financial markets.

GUIDELINES:
1. When answering questions regarding recent news, companies, or events, prioritize any provided verified news dispatches and cite publishers.
2. Clearly distinguish between verified facts from news reports and speculative analysis or AI general knowledge.
3. If asked for financial advice, provide objective market data and context, but explicitly clarify that you do not offer personalized investment recommendations.
4. Be concise, direct, helpful, and objective. Use Markdown formatting with bold headers and bullet points where helpful."#;

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

/// Ask a question grounded strictly in local news articles or specific story context.
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

    let (matching_articles, provider, api_key, model) = {
        let conn = db.0.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
        let arts = search_articles_for_question(&conn, &token_vec, 6)?;
        let prov = get_active_provider(&conn);
        let key = get_provider_api_key(&conn, prov);
        let mdl = get_provider_model(&conn, prov);
        (arts, prov, key, mdl)
    };

    if matching_articles.is_empty() && story_context.is_none() {
        return Ok(AiAnswer {
            question: question_trimmed.to_string(),
            answer: format!(
                "No verified dispatches regarding \"{}\" were found in your local news feed. Orbit does not speculate or invent current events without source citations. Try refreshing live feeds or asking about recent technology, finance, or world news topics.",
                question_trimmed
            ),
            simple_explanation: Some("No local news records match this question yet.".to_string()),
            decision_explanation: Some("Check live RSS feeds for new dispatches on this subject.".to_string()),
            sources: Vec::new(),
            model_used: "local-grounding-check".to_string(),
            created_at: "Just now".to_string(),
        });
    }

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

        match send_chat_completion_with_provider(
            provider,
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
                eprintln!("[Orbit AI] Error in Q&A completion: {e}");
            }
        }
    }

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
