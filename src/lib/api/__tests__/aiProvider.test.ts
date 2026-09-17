import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAiProviderConfig, setAiProviderConfig, type AiProviderConfig } from '../aiProvider';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

const config: AiProviderConfig = {
  provider: 'ollama',
  visionProvider: 'openai',
  openaiBaseUrl: 'https://api.example.com/v1',
  openaiApiKey: 'sk-test',
  openaiEmbeddingModel: 'text-embedding-3-small',
  openaiVisionModel: 'gpt-4o-mini',
  ollamaEmbeddingModel: 'nomic-embed-text',
  ollamaVisionModel: 'llava',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AI provider config API', () => {
  it('reads the effective config from the backend', async () => {
    mockInvoke.mockResolvedValueOnce(config);

    await expect(getAiProviderConfig()).resolves.toEqual(config);
    expect(mockInvoke).toHaveBeenCalledWith('get_ai_provider_cmd');
  });

  it('persists the config through set_ai_provider_cmd', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await setAiProviderConfig({ ...config, provider: 'openai' });

    expect(mockInvoke).toHaveBeenCalledWith('set_ai_provider_cmd', {
      config: { ...config, provider: 'openai' },
    });
  });

  it('propagates backend failures instead of swallowing them', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('settings file is read-only'));

    await expect(setAiProviderConfig(config)).rejects.toThrow('settings file is read-only');
  });
});
