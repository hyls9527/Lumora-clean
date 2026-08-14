/**
 * AI backend selection — local Ollama vs any OpenAI-compatible API.
 */

import { invoke } from '../tauri';

/** Which backend serves a capability: local Ollama or any OpenAI-compatible API. */
export type ProviderKind = 'ollama' | 'openai';

export interface AiProviderConfig {
  provider: ProviderKind;
  visionProvider: ProviderKind;
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
