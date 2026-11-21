//! OpenAI API client and configuration management.
//!
//! Provides secure communication with the OpenAI API using `reqwest`.
//! API keys are retrieved from the SQLite `settings` table or the `OPENAI_API_KEY`
//! environment variable.  Raw credentials are never exposed to the frontend.

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const DEFAULT_MODEL: &str = "gpt-4o-mini";
pub const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfigInfo {
    pub has_key: bool,
    pub masked_key: String,
    pub model: String,
    pub explanation_mode: String,
    pub briefing_length: String,
}

/// Retrieve the active API key from the local database or environment.
pub fn get_api_key(conn: &Connection) -> Option<String> {
    // 1. Check local database settings table
    if let Ok(Some(key)) = crate::db::repository::get_setting(conn, "openai_api_key") {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    // 2. Fall back to environment variable
    if let Ok(key) = std::env::var("OPENAI_API_KEY") {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

/// Retrieve active model name from database settings or default to gpt-4o-mini.
pub fn get_model(conn: &Connection) -> String {
    crate::db::repository::get_setting(conn, "openai_model")
        .ok()
        .flatten()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string())
}

/// Mask the key for safe UI display (e.g. "sk-•••••••a1b2").
pub fn mask_key(key: &str) -> String {
    let len = key.len();
    if len <= 8 {
        return "••••••••".to_string();
    }
    let prefix = if key.starts_with("sk-") { "sk-" } else { &key[..3] };
    let suffix = &key[len - 4..];
    format!("{prefix}••••••••{suffix}")
}

/// Get the consolidated AI configuration for the frontend without exposing raw secrets.
pub fn get_ai_config_info(conn: &Connection) -> AiConfigInfo {
    let key = get_api_key(conn);
    let has_key = key.is_some();
    let masked_key = key.as_deref().map(mask_key).unwrap_or_default();

    let model = get_model(conn);
    let explanation_mode = crate::db::repository::get_setting(conn, "ai_explanation_mode")
        .ok()
        .flatten()
        .unwrap_or_else(|| "simple".to_string());
    let briefing_length = crate::db::repository::get_setting(conn, "briefing_length")
        .ok()
        .flatten()
        .unwrap_or_else(|| "standard".to_string());

    AiConfigInfo {
        has_key,
        masked_key,
        model,
        explanation_mode,
        briefing_length,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Chat Completion API Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorResponse {
    error: Option<ApiErrorDetail>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ApiErrorDetail {
    message: Option<String>,
    #[serde(rename = "type")]
    error_type: Option<String>,
    code: Option<String>,
}

/// Send a completion request to the OpenAI API with retries and timeout.
pub async fn send_chat_completion(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    json_mode: bool,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(35))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    let auth_header = format!("Bearer {api_key}");
    let mut auth_val = HeaderValue::from_str(&auth_header)
        .map_err(|e| format!("Invalid characters in API key: {e}"))?;
    auth_val.set_sensitive(true);
    headers.insert(AUTHORIZATION, auth_val);

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        },
    ];

    let request_payload = ChatCompletionRequest {
        model: model.to_string(),
        messages,
        temperature: 0.2, // Low temperature for high factual precision
        response_format: if json_mode {
            Some(ResponseFormat {
                format_type: "json_object".to_string(),
            })
        } else {
            None
        },
        max_tokens,
    };

    // Attempt request with 1 retry on 5xx errors
    let mut attempts = 0;
    loop {
        attempts += 1;
        let response = client
            .post(OPENAI_API_URL)
            .headers(headers.clone())
            .json(&request_payload)
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    let parsed: ChatCompletionResponse = resp
                        .json()
                        .await
                        .map_err(|e| format!("Failed to parse OpenAI response JSON: {e}"))?;

                    if let Some(choice) = parsed.choices.into_iter().next() {
                        if let Some(content) = choice.message.content {
                            return Ok(content);
                        }
                    }
                    return Err("Empty response content from OpenAI model".to_string());
                }

                // Check error status
                let error_body = resp.text().await.unwrap_or_default();
                let err_msg = if let Ok(err_parsed) = serde_json::from_str::<ApiErrorResponse>(&error_body) {
                    err_parsed
                        .error
                        .and_then(|e| e.message)
                        .unwrap_or_else(|| format!("HTTP {status}"))
                } else {
                    format!("HTTP {status}: {error_body}")
                };

                if status.as_u16() == 401 {
                    return Err("Invalid OpenAI API Key. Please verify your API key in Settings > AI Configuration.".to_string());
                } else if status.as_u16() == 429 {
                    return Err(format!("OpenAI Rate Limit / Quota Exceeded: {err_msg}"));
                } else if status.is_server_error() && attempts < 2 {
                    tokio::time::sleep(Duration::from_millis(1500)).await;
                    continue;
                } else {
                    return Err(format!("OpenAI API error ({status}): {err_msg}"));
                }
            }
            Err(e) => {
                if attempts < 2 && (e.is_timeout() || e.is_connect()) {
                    tokio::time::sleep(Duration::from_millis(1500)).await;
                    continue;
                }
                return Err(format!("Network connection to OpenAI failed: {e}"));
            }
        }
    }
}
