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
    pub vision_provider: String,
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
            vision_provider: PROVIDER_OLLAMA.to_string(),
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

/// Load the effective provider config (settings → env → defaults).
pub fn load_config(app: &tauri::AppHandle) -> AiProviderConfig {
    resolve_config(&|key| store_str(app, key), &|key| {
        std::env::var(key).ok().filter(|s| !s.trim().is_empty())
    })
}

/// Pure config resolution: store value first, then env, then defaults.
/// Extracted for unit testing without an `AppHandle`.
pub(crate) fn resolve_config(
    store: &dyn Fn(&str) -> Option<String>,
    env: &dyn Fn(&str) -> Option<String>,
) -> AiProviderConfig {
    let defaults = AiProviderConfig::default();
    let pick = |store_key: &str, env_key: Option<&str>, fallback: &str| -> String {
        store(store_key)
            .or_else(|| env_key.and_then(env))
            .unwrap_or_else(|| fallback.to_string())
    };
    AiProviderConfig {
        provider: store("ai.provider")
            .or_else(|| env("LUMORA_AI_PROVIDER"))
            .unwrap_or_else(|| defaults.provider.clone()),
        vision_provider: store("ai.vision_provider")
            .or_else(|| env("LUMORA_VISION_PROVIDER"))
            .unwrap_or_else(|| defaults.vision_provider.clone()),
        openai_base_url: pick(
            "ai.openai_base_url",
            Some("OPENAI_BASE_URL"),
            &defaults.openai_base_url,
        ),
        openai_api_key: pick("ai.openai_api_key", Some("OPENAI_API_KEY"), ""),
        openai_embedding_model: pick(
            "ai.openai_embedding_model",
            Some("OPENAI_EMBEDDING_MODEL"),
            &defaults.openai_embedding_model,
        ),
        openai_vision_model: pick(
            "ai.openai_vision_model",
            Some("OPENAI_VISION_MODEL"),
            &defaults.openai_vision_model,
        ),
        ollama_embedding_model: pick(
            "ai.ollama_embedding_model",
            None,
            &defaults.ollama_embedding_model,
        ),
        ollama_vision_model: pick(
            "ai.ollama_vision_model",
            None,
            &defaults.ollama_vision_model,
        ),
    }
}

/// Persist the provider config to the settings store.
pub fn save_config(app: &tauri::AppHandle, config: &AiProviderConfig) -> AppResult<()> {
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::External(format!("failed to open store: {e}")))?;
    for (key, value) in [
        ("ai.provider", &config.provider),
        ("ai.vision_provider", &config.vision_provider),
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
    match config.vision_provider.as_str() {
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
        .timeout(std::time::Duration::from_secs(300))
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
    if is_loopback_url(&config.openai_base_url) {
        // Local OpenAI-compatible servers (llama.cpp, Ollama's OpenAI layer)
        // typically run without an API key.
        return Ok(());
    }
    if config.openai_api_key.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "OpenAI 后端未配置 API Key（设置 → AI 后端）".to_string(),
        ));
    }
    Ok(())
}

fn is_loopback_url(base_url: &str) -> bool {
    base_url.contains("://127.0.0.1") || base_url.contains("://localhost") || base_url.contains("://[::1]")
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
    use axum::routing::post;
    use axum::{Json, Router};

    #[test]
    fn default_config_uses_local_ollama() {
        let defaults = AiProviderConfig::default();
        assert_eq!(defaults.provider, PROVIDER_OLLAMA);
        assert_eq!(defaults.vision_provider, PROVIDER_OLLAMA);
        assert_eq!(defaults.ollama_embedding_model, "nomic-embed-text");
        assert_eq!(defaults.ollama_vision_model, "llava:latest");
    }

    #[test]
    fn vision_provider_resolves_independently_and_localhost_skips_key() {
        let store = |key: &str| match key {
            "ai.vision_provider" => Some(PROVIDER_OPENAI.to_string()),
            _ => None,
        };
        let none = |_: &str| None::<String>;
        let config = resolve_config(&store, &none);
        // Vision can switch to an OpenAI-compatible backend while the main
        // provider (and therefore embeddings) stays on Ollama.
        assert_eq!(config.vision_provider, PROVIDER_OPENAI);
        assert_eq!(config.provider, PROVIDER_OLLAMA);

        // Loopback OpenAI-compatible servers don't require an API key.
        let local = AiProviderConfig {
            openai_base_url: "http://127.0.0.1:8090/v1".to_string(),
            openai_api_key: String::new(),
            ..Default::default()
        };
        assert!(require_openai_key(&local).is_ok());
        let remote = AiProviderConfig {
            openai_base_url: "https://api.example.com/v1".to_string(),
            openai_api_key: String::new(),
            ..Default::default()
        };
        assert!(require_openai_key(&remote).is_err());
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

    #[test]
    fn resolve_config_prefers_store_then_env_then_defaults() {
        let store = |key: &str| match key {
            "ai.provider" => Some("openai".to_string()),
            "ai.openai_api_key" => Some("sk-store".to_string()),
            _ => None,
        };
        let env = |key: &str| match key {
            "OPENAI_BASE_URL" => Some("https://env.example/v1".to_string()),
            "OPENAI_API_KEY" => Some("sk-env".to_string()),
            _ => None,
        };
        let config = resolve_config(&store, &env);
        assert_eq!(config.provider, "openai");
        // Store wins over env for the key.
        assert_eq!(config.openai_api_key, "sk-store");
        // Env fills what store lacks.
        assert_eq!(config.openai_base_url, "https://env.example/v1");
        // Defaults fill the rest.
        assert_eq!(config.openai_embedding_model, "text-embedding-3-small");
    }

    #[test]
    fn resolve_config_falls_back_to_ollama_defaults() {
        let none = |_: &str| None::<String>;
        let config = resolve_config(&none, &none);
        assert_eq!(config.provider, PROVIDER_OLLAMA);
        assert_eq!(config.ollama_embedding_model, "nomic-embed-text");
    }

    #[test]
    fn openai_embed_requires_api_key() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let config = AiProviderConfig {
                provider: PROVIDER_OPENAI.to_string(),
                openai_api_key: String::new(),
                ..Default::default()
            };
            let err = openai_embed(&config, "hello").await.unwrap_err();
            assert!(err.to_string().contains("API Key"));
        });
    }

    #[test]
    fn openai_embed_hits_compatible_endpoint() {
        async fn handler(Json(_body): Json<Value>) -> Json<Value> {
            Json(json!({ "data": [{ "embedding": [0.1, 0.2, 0.3] }] }))
        }
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let router = Router::new().route("/v1/embeddings", post(handler));
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            let task = tokio::spawn(async move {
                let _ = axum::serve(listener, router).await;
            });

            let config = AiProviderConfig {
                provider: PROVIDER_OPENAI.to_string(),
                openai_base_url: format!("http://127.0.0.1:{port}/v1"),
                openai_api_key: "sk-test".to_string(),
                ..Default::default()
            };
            let vec = openai_embed(&config, "hello").await.unwrap();
            assert_eq!(vec, vec![0.1, 0.2, 0.3]);
            task.abort();
        });
    }

    #[test]
    fn openai_embed_surfaces_http_errors() {
        async fn handler() -> axum::http::StatusCode {
            axum::http::StatusCode::UNAUTHORIZED
        }
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let router = Router::new().route("/v1/embeddings", post(handler));
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            let task = tokio::spawn(async move {
                let _ = axum::serve(listener, router).await;
            });

            let config = AiProviderConfig {
                provider: PROVIDER_OPENAI.to_string(),
                openai_base_url: format!("http://127.0.0.1:{port}/v1"),
                openai_api_key: "sk-test".to_string(),
                ..Default::default()
            };
            let err = openai_embed(&config, "hello").await.unwrap_err();
            assert!(err.to_string().contains("401"));
            task.abort();
        });
    }

    #[test]
    fn openai_analyze_hits_compatible_chat_endpoint() {
        async fn handler(Json(_body): Json<Value>) -> Json<Value> {
            Json(json!({
                "choices": [{
                    "message": {
                        "content": "{\"description\":\"a cat\",\"tags\":[],\"objects\":[],\"color_palette\":[],\"composition\":\"\"}"
                    }
                }]
            }))
        }
        let dir = tempfile::tempdir().unwrap();
        let image_path = dir.path().join("cat.png");
        let img = image::RgbImage::from_pixel(4, 4, image::Rgb([10, 20, 30]));
        img.save(&image_path).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let router = Router::new().route("/v1/chat/completions", post(handler));
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            let task = tokio::spawn(async move {
                let _ = axum::serve(listener, router).await;
            });

            let config = AiProviderConfig {
                provider: PROVIDER_OPENAI.to_string(),
                openai_base_url: format!("http://127.0.0.1:{port}/v1"),
                openai_api_key: "sk-test".to_string(),
                ..Default::default()
            };
            let result = openai_analyze(&config, image_path.to_str().unwrap())
                .await
                .unwrap();
            assert_eq!(result.description, "a cat");
            task.abort();
        });
    }
}
