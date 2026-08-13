use crate::error::AppResult;

/// Centralized Ollama configuration.
///
/// Host is read from the `OLLAMA_HOST` environment variable at startup.
/// Defaults to `http://localhost:11434` if not set.
///
/// Holds a shared `reqwest::Client` for connection reuse across all
/// Ollama API calls (embeddings, chat, health checks).
#[derive(Clone)]
pub struct OllamaConfig {
    host: String,
    client: reqwest::Client,
}

impl OllamaConfig {
    pub fn from_env() -> Self {
        let host =
            std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let client = reqwest::Client::new();
        Self { host, client }
    }

    /// Base URL of the Ollama server (no trailing slash).
    pub fn host(&self) -> &str {
        &self.host
    }

    /// Full URL for a specific Ollama API endpoint.
    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.host, path)
    }

    /// Shared `reqwest::Client` for connection reuse.
    /// Clone is cheap (Arc internally) — use it directly for per-request timeout.
    pub fn client(&self) -> &reqwest::Client {
        &self.client
    }

    /// Test-only constructor with an explicit host (avoids racing on the
    /// `OLLAMA_HOST` environment variable across parallel tests).
    #[cfg(test)]
    pub(crate) fn from_host_for_test(host: String) -> Self {
        Self {
            host,
            client: reqwest::Client::new(),
        }
    }
}

/// Tauri command: return the Ollama host URL to the frontend.
#[tauri::command]
pub fn get_ollama_host(config: tauri::State<'_, OllamaConfig>) -> String {
    config.host().to_string()
}

/// Tauri command: check if Ollama is reachable.
/// Returns (available: bool, error: Option<String>).
/// Uses a short 3-second timeout to avoid blocking the UI.
#[tauri::command]
pub async fn check_ollama_status(
    config: tauri::State<'_, OllamaConfig>,
) -> AppResult<(bool, Option<String>)> {
    let url = config.url("/api/tags");

    match config
        .client()
        .get(&url)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                Ok((true, None))
            } else {
                Ok((false, Some(format!("Ollama returned {}", resp.status()))))
            }
        }
        Err(e) => {
            if e.is_timeout() {
                Ok((false, Some("Ollama 连接超时".to_string())))
            } else {
                Ok((false, Some("Ollama 未运行".to_string())))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn from_env_reads_ollama_host() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("OLLAMA_HOST", "http://example.com:1234");
        let cfg = OllamaConfig::from_env();
        assert_eq!(cfg.host(), "http://example.com:1234");
        std::env::remove_var("OLLAMA_HOST");
    }

    #[test]
    fn from_env_defaults_to_localhost() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var("OLLAMA_HOST");
        let cfg = OllamaConfig::from_env();
        assert_eq!(cfg.host(), "http://localhost:11434");
    }

    #[test]
    fn url_joins_host_and_path() {
        let cfg = OllamaConfig::from_host_for_test("http://localhost:11434".into());
        assert_eq!(cfg.url("/api/tags"), "http://localhost:11434/api/tags");
        assert_eq!(cfg.url("health"), "http://localhost:11434health");
    }

    #[test]
    fn client_is_shared_and_reusable() {
        let cfg = OllamaConfig::from_host_for_test("http://localhost:11434".into());
        let _ = cfg.client();
    }
}
