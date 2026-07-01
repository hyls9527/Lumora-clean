/// Centralized Ollama configuration.
///
/// Host is read from the `OLLAMA_HOST` environment variable at startup.
/// Defaults to `http://localhost:11434` if not set.
#[derive(Clone)]
pub struct OllamaConfig {
    host: String,
}

impl OllamaConfig {
    pub fn from_env() -> Self {
        let host = std::env::var("OLLAMA_HOST")
            .unwrap_or_else(|_| "http://localhost:11434".to_string());
        Self { host }
    }

    /// Base URL of the Ollama server (no trailing slash).
    pub fn host(&self) -> &str {
        &self.host
    }

    /// Full URL for a specific Ollama API endpoint.
    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.host, path)
    }
}

/// Tauri command: return the Ollama host URL to the frontend.
#[tauri::command]
pub fn get_ollama_host(config: tauri::State<'_, OllamaConfig>) -> String {
    config.host().to_string()
}
