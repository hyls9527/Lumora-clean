/**
 * AI backend selection — local Ollama vs any OpenAI-compatible API.
 */

import { invoke } from '../tauri';

export interface AiProviderConfig {
  provider: string; // 'ollama' | 'openai'
  visionProvider: string; // 'ollama' | 'openai'
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiEmbeddingModel: string;
  openaiVisionModel: string;
  ollamaEmbeddingModel: string;
  ollamaVisionModel: string;
}

/** Read the effective AI provider config. */
export async function getAiProviderConfig(): Promise<AiProviderConfig> {
  return invoke<AiProviderConfig>('get_ai_provider_cmd');
}

/** Persist the AI provider config. */
export async function setAiProviderConfig(config: AiProviderConfig): Promise<void> {
  await invoke('set_ai_provider_cmd', { config });
}
