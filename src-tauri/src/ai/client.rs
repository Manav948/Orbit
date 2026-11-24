//! Multi-provider AI client and secure credential management.
//!
//! Supports Groq, OpenAI, and Google Gemini with a unified request/response contract.
//! API credentials are read from SQLite `settings` table or respective environment variables.
//! Raw secrets are never exposed to React or logged.

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    OpenAi,
    Groq,
    Gemini,
}

impl AiProvider {
    pub fn from_str_name(s: &str) -> Self {
        match s.to_lowercase().trim() {
            "groq" => Self::Groq,
            "gemini" | "google" => Self::Gemini,
            _ => Self::OpenAi,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::Groq => "groq",
            Self::Gemini => "gemini",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::OpenAi => "OpenAI",
            Self::Groq => "Groq (Ultra-Fast)",
            Self::Gemini => "Google Gemini",
        }
    }

    pub fn default_model(&self) -> &'static str {
        match self {
            Self::OpenAi => "gpt-4o-mini",
            Self::Groq => "llama-3.3-70b-versatile",
            Self::Gemini => "gemini-1.5-flash",
        }
    }

    pub fn available_models(&self) -> Vec<&'static str> {
        match self {
            Self::OpenAi => vec!["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
            Self::Groq => vec![
                "llama-3.3-70b-versatile",
                "llama-3.1-8b-instant",
                "mixtral-8x7b-32768",
            ],
            Self::Gemini => vec!["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
        }
    }

    pub fn api_url(&self) -> &'static str {
        match self {
            Self::OpenAi => "https://api.openai.com/v1/chat/completions",
            Self::Groq => "https://api.groq.com/openai/v1/chat/completions",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        }
    }

    pub fn key_setting_name(&self) -> &'static str {
        match self {
            Self::OpenAi => "openai_api_key",
            Self::Groq => "groq_api_key",
            Self::Gemini => "gemini_api_key",
        }
    }

    pub fn model_setting_name(&self) -> &'static str {
        match self {
            Self::OpenAi => "openai_model",
            Self::Groq => "groq_model",
            Self::Gemini => "gemini_model",
        }
    }

    pub fn env_var_names(&self) -> Vec<&'static str> {
        match self {
            Self::OpenAi => vec!["OPENAI_API_KEY"],
            Self::Groq => vec!["GROQ_API_KEY"],
            Self::Gemini => vec!["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfigInfo {
    pub id: String,
    pub name: String,
    pub has_key: bool,
    pub masked_key: String,
    pub active_model: String,
    pub available_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAiConfigInfo {
    pub active_provider: String,
    pub providers: Vec<ProviderConfigInfo>,
    pub explanation_mode: String,
    pub briefing_length: String,
}

// Backwards compatibility struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfigInfo {
    pub has_key: bool,
    pub masked_key: String,
    pub model: String,
    pub explanation_mode: String,
    pub briefing_length: String,
}

/// Retrieve the active provider configured in SQLite settings with smart fallback.
pub fn get_active_provider(conn: &Connection) -> AiProvider {
    if let Ok(Some(s)) = crate::db::repository::get_setting(conn, "active_ai_provider") {
        let p = AiProvider::from_str_name(&s);
        if get_provider_api_key(conn, p).is_some() {
            return p;
        }
    }

    // Smart auto-detection: if the configured active provider has no key,
    // automatically use whichever provider the user has configured credentials for.
    if get_provider_api_key(conn, AiProvider::Groq).is_some() {
        return AiProvider::Groq;
    }
    if get_provider_api_key(conn, AiProvider::OpenAi).is_some() {
        return AiProvider::OpenAi;
    }
    if get_provider_api_key(conn, AiProvider::Gemini).is_some() {
        return AiProvider::Gemini;
    }

    AiProvider::Groq
}

/// Retrieve the API key for a specific provider.
pub fn get_provider_api_key(conn: &Connection, provider: AiProvider) -> Option<String> {
    // 1. Check local database settings table
    if let Ok(Some(key)) = crate::db::repository::get_setting(conn, provider.key_setting_name()) {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    // 2. Fall back to environment variable
    for env_var in provider.env_var_names() {
        if let Ok(key) = std::env::var(env_var) {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

/// Retrieve the active model for a specific provider.
pub fn get_provider_model(conn: &Connection, provider: AiProvider) -> String {
    crate::db::repository::get_setting(conn, provider.model_setting_name())
        .ok()
        .flatten()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| provider.default_model().to_string())
}

/// Mask the key for safe UI display (e.g. "gsk_••••••••1a2b" or "AIza••••••••").
pub fn mask_key(key: &str) -> String {
    let len = key.len();
    if len <= 8 {
        return "••••••••".to_string();
    }
    let prefix = if key.starts_with("sk-") {
        "sk-"
    } else if key.starts_with("gsk_") {
        "gsk_"
    } else if key.starts_with("AIza") {
        "AIza"
    } else {
        &key[..3]
    };
    let suffix = &key[len - 4..];
    format!("{prefix}••••••••{suffix}")
}

/// Get the legacy `AiConfigInfo` for backwards compatibility with existing UI callers.
pub fn get_ai_config_info(conn: &Connection) -> AiConfigInfo {
    let provider = get_active_provider(conn);
    let key = get_provider_api_key(conn, provider);
    let has_key = key.is_some();
    let masked_key = key.as_deref().map(mask_key).unwrap_or_default();
    let model = get_provider_model(conn, provider);

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

/// Get the full multi-provider configuration without exposing raw keys.
pub fn get_multi_ai_config_info(conn: &Connection) -> MultiAiConfigInfo {
    let active_provider = get_active_provider(conn);
    let all_providers = [AiProvider::Groq, AiProvider::OpenAi, AiProvider::Gemini];

    let mut provider_infos = Vec::new();
    for p in all_providers {
        let key = get_provider_api_key(conn, p);
        let has_key = key.is_some();
        let masked = key.as_deref().map(mask_key).unwrap_or_default();
        let active_model = get_provider_model(conn, p);
        let available_models = p.available_models().into_iter().map(String::from).collect();

        provider_infos.push(ProviderConfigInfo {
            id: p.as_str().to_string(),
            name: p.display_name().to_string(),
            has_key,
            masked_key: masked,
            active_model,
            available_models,
        });
    }

    let explanation_mode = crate::db::repository::get_setting(conn, "ai_explanation_mode")
        .ok()
        .flatten()
        .unwrap_or_else(|| "simple".to_string());
    let briefing_length = crate::db::repository::get_setting(conn, "briefing_length")
        .ok()
        .flatten()
        .unwrap_or_else(|| "standard".to_string());

    MultiAiConfigInfo {
        active_provider: active_provider.as_str().to_string(),
        providers: provider_infos,
        explanation_mode,
        briefing_length,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Completion API Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
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

/// Send a completion request to any supported AI provider.
pub async fn send_chat_completion_with_provider(
    provider: AiProvider,
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
        temperature: 0.2,
        response_format: if json_mode {
            Some(ResponseFormat {
                format_type: "json_object".to_string(),
            })
        } else {
            None
        },
        max_tokens,
    };

    let mut attempts = 0;
    loop {
        attempts += 1;
        let response = client
            .post(provider.api_url())
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
                        .map_err(|e| format!("Failed to parse {} response JSON: {e}", provider.display_name()))?;

                    if let Some(choice) = parsed.choices.into_iter().next() {
                        if let Some(content) = choice.message.content {
                            return Ok(content);
                        }
                    }
                    return Err(format!("Empty response content from {} model", provider.display_name()));
                }

                let error_body = resp.text().await.unwrap_or_default();
                let err_msg = if let Ok(err_parsed) = serde_json::from_str::<ApiErrorResponse>(&error_body) {
                    err_parsed
                        .error
                        .and_then(|e| e.message)
                        .unwrap_or_else(|| format!("HTTP {status}"))
                } else {
                    format!("HTTP {status}: {error_body}")
                };

                if status.as_u16() == 401 || status.as_u16() == 403 {
                    return Err(format!(
                        "Invalid API Key for {}. Please verify your key in Settings > AI Configuration.",
                        provider.display_name()
                    ));
                } else if status.as_u16() == 429 {
                    return Err(format!(
                        "{} Rate Limit or Quota Exceeded: {err_msg}. Please check your provider account quota or switch to another provider.",
                        provider.display_name()
                    ));
                } else if status.is_server_error() && attempts < 2 {
                    tokio::time::sleep(Duration::from_millis(1500)).await;
                    continue;
                } else {
                    return Err(format!("{} API error ({status}): {err_msg}", provider.display_name()));
                }
            }
            Err(e) => {
                if attempts < 2 && (e.is_timeout() || e.is_connect()) {
                    tokio::time::sleep(Duration::from_millis(1500)).await;
                    continue;
                }
                return Err(format!("Network connection to {} failed: {e}", provider.display_name()));
            }
        }
    }
}

/// Send a multi-turn conversation request to any supported AI provider.
pub async fn send_conversation_completion(
    provider: AiProvider,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
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

    let request_payload = ChatCompletionRequest {
        model: model.to_string(),
        messages,
        temperature: 0.3,
        response_format: None,
        max_tokens,
    };

    let response = client
        .post(provider.api_url())
        .headers(headers)
        .json(&request_payload)
        .send()
        .await
        .map_err(|e| format!("Network request to {} failed: {e}", provider.display_name()))?;

    let status = response.status();
    if status.is_success() {
        let parsed: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response JSON: {e}"))?;

        if let Some(choice) = parsed.choices.into_iter().next() {
            if let Some(content) = choice.message.content {
                return Ok(content);
            }
        }
        return Err("Empty response content from AI model".to_string());
    }

    let error_body = response.text().await.unwrap_or_default();
    if status.as_u16() == 401 {
        Err(format!("Invalid {} API key. Please update in Settings.", provider.display_name()))
    } else if status.as_u16() == 429 {
        Err(format!("{} rate limit exceeded. Please try again shortly.", provider.display_name()))
    } else {
        Err(format!("{} error ({status}): {error_body}", provider.display_name()))
    }
}

/// Legacy wrapper for backwards compatibility with existing engine code.
#[allow(dead_code)]
pub async fn send_chat_completion(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    json_mode: bool,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    send_chat_completion_with_provider(
        AiProvider::OpenAi,
        api_key,
        model,
        system_prompt,
        user_prompt,
        json_mode,
        max_tokens,
    )
    .await
}

#[derive(Debug, Deserialize)]
struct WhisperResponse {
    text: Option<String>,
}

/// Determines which provider and credentials to use for speech-to-text.
pub fn get_whisper_config(conn: &Connection) -> Result<(AiProvider, String, &'static str, &'static str), String> {
    if let Some(groq_key) = get_provider_api_key(conn, AiProvider::Groq) {
        Ok((
            AiProvider::Groq,
            groq_key,
            "whisper-large-v3-turbo",
            "https://api.groq.com/openai/v1/audio/transcriptions",
        ))
    } else if let Some(openai_key) = get_provider_api_key(conn, AiProvider::OpenAi) {
        Ok((
            AiProvider::OpenAi,
            openai_key,
            "whisper-1",
            "https://api.openai.com/v1/audio/transcriptions",
        ))
    } else {
        Err(
            "No Groq or OpenAI API key found for speech recognition. Please paste your Groq API key in Settings > Multi-Provider AI."
                .to_string(),
        )
    }
}

/// Transcribes speech audio using Groq Whisper (ultra-fast ~200ms) or OpenAI Whisper.
pub async fn transcribe_audio(
    provider: AiProvider,
    api_key: String,
    model: &'static str,
    endpoint: &'static str,
    audio_bytes: Vec<u8>,
    mime_type: Option<&str>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mime = mime_type.unwrap_or("audio/webm");
    let file_part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name("recording.webm")
        .mime_str(mime)
        .map_err(|e| format!("Invalid audio MIME type: {e}"))?;

    let form = reqwest::multipart::Form::new()
        .text("model", model.to_string())
        .text("response_format", "json")
        .part("file", file_part);

    let response = client
        .post(endpoint)
        .header("Authorization", format!("Bearer {api_key}"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Transcription network error to {}: {e}", provider.display_name()))?;

    let status = response.status();
    if status.is_success() {
        let parsed: WhisperResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Whisper response: {e}"))?;

        if let Some(txt) = parsed.text {
            let trimmed = txt.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(trimmed);
            }
            return Err("No audible speech detected in recording. Please try speaking closer to your microphone.".to_string());
        }
        return Err("Empty transcript returned by Whisper.".to_string());
    }

    let error_body = response.text().await.unwrap_or_default();
    Err(format!(
        "{} Whisper error ({}): {}",
        provider.display_name(),
        status,
        error_body
    ))
}
