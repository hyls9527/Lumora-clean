//! Multi-AI backend: local Ollama vs any OpenAI-compatible API.
//!
//! Semantic search embeddings and vision analysis are dispatched through this
//! module so users can switch providers without restarting. Configuration
//! precedence: persistent settings store → environment variables → defaults.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri_plugin_store::StoreExt;

use crate::commands::ai::AnalysisResult;
use crate::error::{AppError, AppResult};
use crate::ollama::OllamaConfig;

pub const PROVIDER_OLLAMA: &str = "ollama";
pub const PROVIDER_OPENAI: &str = "openai";

/// User-facing AI provider configuration (persisted in settings.json).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderConfig {
    pub provider: String,
    pub openai_base_url: String,
    pub openai_api_key: String,
    pub openai_embedding_model: String,
    pub openai_vision_model: String,
    pub ollama_embedding_model: String,
    pub ollama_vision_model: String,
}

impl Default for AiProviderConfig {
    fn default() -> Self {
        Self {
            provider: PROVIDER_OLLAMA.to_string(),
            openai_base_url: "https://api.openai.com/v1".to_string(),
            openai_api_key: String::new(),
            openai_embedding_model: "text-embedding-3-small".to_string(),
            openai_vision_model: "gpt-4o-mini".to_string(),
            ollama_embedding_model: "nomic-embed-text".to_string(),
            ollama_vision_model: "llava:latest".to_string(),
        }
    }
}

fn store_str(app: &tauri::AppHandle, key: &str) -> Option<String> {
    let store = app.store("settings.json").ok()?;
    store
        .get(key)
        .and_then(|v| v.as_str().map(str::to_string))
        .filter(|s| !s.trim().is_empty())
}

fn env_or(key: &str, fallback: &str) -> String {
    std::env::var(key)
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

/// Load the effective provider config (settings → env → defaults).
pub fn load_config(app: &tauri::AppHandle) -> AiProviderConfig {
    let defaults = AiProviderConfig::default();
    AiProviderConfig {
        provider: store_str(app, "ai.provider")
            .unwrap_or_else(|| env_or("LUMORA_AI_PROVIDER", PROVIDER_OLLAMA)),
        openai_base_url: store_str(app, "ai.openai_base_url")
            .unwrap_or_else(|| env_or("OPENAI_BASE_URL", &defaults.openai_base_url)),
        openai_api_key: store_str(app, "ai.openai_api_key")
            .unwrap_or_else(|| env_or("OPENAI_API_KEY", "")),
        openai_embedding_model: store_str(app, "ai.openai_embedding_model")
            .unwrap_or_else(|| env_or("OPENAI_EMBEDDING_MODEL", &defaults.openai_embedding_model)),
        openai_vision_model: store_str(app, "ai.openai_vision_model")
            .unwrap_or_else(|| env_or("OPENAI_VISION_MODEL", &defaults.openai_vision_model)),
        ollama_embedding_model: store_str(app, "ai.ollama_embedding_model")
            .unwrap_or(defaults.ollama_embedding_model),
        ollama_vision_model: store_str(app, "ai.ollama_vision_model")
            .unwrap_or(defaults.ollama_vision_model),
    }
}

/// Persist the provider config to the settings store.
pub fn save_config(app: &tauri::AppHandle, config: &AiProviderConfig) -> AppResult<()> {
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::External(format!("failed to open store: {e}")))?;
    for (key, value) in [
        ("ai.provider", &config.provider),
        ("ai.openai_base_url", &config.openai_base_url),
        ("ai.openai_api_key", &config.openai_api_key),
        ("ai.openai_embedding_model", &config.openai_embedding_model),
        ("ai.openai_vision_model", &config.openai_vision_model),
        ("ai.ollama_embedding_model", &config.ollama_embedding_model),
        ("ai.ollama_vision_model", &config.ollama_vision_model),
    ] {
        store.set(key, json!(value));
    }
    store
        .save()
        .map_err(|e| AppError::External(format!("failed to save store: {e}")))
}

/// Embed text through the active provider.
pub async fn embed_text(
    app: &tauri::AppHandle,
    ollama: &OllamaConfig,
    text: &str,
    model_override: Option<&str>,
) -> AppResult<Vec<f64>> {
    let config = load_config(app);
    match config.provider.as_str() {
        PROVIDER_OPENAI => openai_embed(&config, text).await,
        _ => {
            let model = model_override
                .map(str::to_string)
                .unwrap_or(config.ollama_embedding_model);
            crate::commands::embeddings::embed_text_ollama(ollama, text, &model).await
        }
    }
}

/// Analyze an image through the active provider.
pub async fn analyze_image(
    app: &tauri::AppHandle,
    ollama: &OllamaConfig,
    image_path: &str,
    model_override: Option<&str>,
) -> AppResult<AnalysisResult> {
    let config = load_config(app);
    match config.provider.as_str() {
        PROVIDER_OPENAI => openai_analyze(&config, image_path).await,
        _ => {
            let model = model_override
                .map(str::to_string)
                .unwrap_or(config.ollama_vision_model);
            crate::commands::ai::call_ollama_analyze(ollama, image_path, &model).await
        }
    }
}

async fn openai_embed(config: &AiProviderConfig, text: &str) -> AppResult<Vec<f64>> {
    require_openai_key(config)?;
    let url = format!(
        "{}/embeddings",
        config.openai_base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .bearer_auth(&config.openai_api_key)
        .timeout(std::time::Duration::from_secs(30))
        .json(&json!({ "model": config.openai_embedding_model, "input": text }))
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(AppError::External(format!(
            "OpenAI embeddings returned status: {}",
            response.status()
        )));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {e}"))?;
    parse_openai_embedding(&body).ok_or_else(|| {
        AppError::External(format!(
            "Invalid OpenAI embeddings response shape: {}",
            body
        ))
    })
}

async fn openai_analyze(config: &AiProviderConfig, image_path: &str) -> AppResult<AnalysisResult> {
    require_openai_key(config)?;
    let image_bytes =
        std::fs::read(image_path).map_err(|e| format!("Failed to read image: {e}"))?;
    use base64::Engine;
    let image_base64 = base64::engine::general_purpose::STANDARD.encode(&image_bytes);
    let data_url = format!("data:image/jpeg;base64,{image_base64}");

    let prompt = crate::commands::ai::ANALYSIS_PROMPT;
    let url = format!(
        "{}/chat/completions",
        config.openai_base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .bearer_auth(&config.openai_api_key)
        .timeout(std::time::Duration::from_secs(120))
        .json(&json!({
            "model": config.openai_vision_model,
            "max_tokens": 800,
            "messages": [{
                "role": "user",
                "content": [
                    { "type": "text", "text": prompt },
                    { "type": "image_url", "image_url": { "url": data_url } }
                ]
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(AppError::External(format!(
            "OpenAI chat returned status: {}",
            response.status()
        )));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {e}"))?;
    let content = parse_openai_chat_content(&body)
        .ok_or_else(|| AppError::External(format!("Invalid OpenAI chat response shape: {body}")))?;
    parse_analysis_content(&content)
}

fn require_openai_key(config: &AiProviderConfig) -> AppResult<()> {
    if config.openai_api_key.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "OpenAI 后端未配置 API Key（设置 → AI 后端）".to_string(),
        ));
    }
    Ok(())
}

/// Extract the embedding vector from an OpenAI `/v1/embeddings` response.
pub fn parse_openai_embedding(body: &Value) -> Option<Vec<f64>> {
    body["data"]
        .get(0)?
        .get("embedding")?
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|v| v.as_f64().unwrap_or(0.0))
                .collect::<Vec<f64>>()
        })
}

/// Extract assistant text from an OpenAI chat-completions response.
pub fn parse_openai_chat_content(body: &Value) -> Option<String> {
    body["choices"]
        .get(0)?
        .get("message")?
        .get("content")?
        .as_str()
        .map(str::to_string)
}

/// Parse the JSON analysis payload out of model output, tolerating markdown
/// code fences and leading/trailing prose (models frequently wrap the JSON).
pub fn parse_analysis_content(raw: &str) -> AppResult<AnalysisResult> {
    let trimmed = raw.trim();
    let candidate = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .and_then(|s| s.strip_suffix("```"))
        .unwrap_or(trimmed)
        .trim();

    if let Ok(result) = serde_json::from_str::<AnalysisResult>(candidate) {
        return Ok(result);
    }
    // Fallback: locate the first {...} block in the raw text.
    let start = candidate.find('{');
    let end = candidate.rfind('}');
    match (start, end) {
        (Some(s), Some(e)) if e > s => Ok(serde_json::from_str::<AnalysisResult>(
            &candidate[s..=e],
        )
        .map_err(|err| AppError::External(format!("Failed to parse analysis result: {err}")))?),
        _ => Err(AppError::External(
            "Failed to parse analysis result: no JSON object found".to_string(),
        )),
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_ai_provider_cmd(app: tauri::AppHandle) -> AiProviderConfig {
    load_config(&app)
}

#[tauri::command]
pub fn set_ai_provider_cmd(app: tauri::AppHandle, config: AiProviderConfig) -> AppResult<()> {
    save_config(&app, &config)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_local_ollama() {
        let defaults = AiProviderConfig::default();
        assert_eq!(defaults.provider, PROVIDER_OLLAMA);
        assert_eq!(defaults.ollama_embedding_model, "nomic-embed-text");
        assert_eq!(defaults.ollama_vision_model, "llava:latest");
    }

    #[test]
    fn parse_openai_embedding_shape() {
        let body = json!({ "data": [{ "embedding": [0.1, 0.2, 0.3] }] });
        assert_eq!(parse_openai_embedding(&body), Some(vec![0.1, 0.2, 0.3]));
        assert_eq!(parse_openai_embedding(&json!({ "data": [] })), None);
    }

    #[test]
    fn parse_openai_chat_content_shape() {
        let body = json!({ "choices": [{ "message": { "content": "hello" } }] });
        assert_eq!(parse_openai_chat_content(&body), Some("hello".to_string()));
        assert_eq!(parse_openai_chat_content(&json!({ "choices": [] })), None);
    }

    #[test]
    fn parse_analysis_content_accepts_fences_and_prose() {
        let payload = json!({
            "description": "a cat",
            "tags": [],
            "objects": [],
            "color_palette": [],
            "composition": ""
        });
        let fenced = format!("```json\n{payload}\n```");
        let parsed = parse_analysis_content(&fenced).unwrap();
        assert_eq!(parsed.description, "a cat");

        let prose = format!("Here you go: {payload} hope it helps");
        let parsed = parse_analysis_content(&prose).unwrap();
        assert_eq!(parsed.description, "a cat");
    }
}
