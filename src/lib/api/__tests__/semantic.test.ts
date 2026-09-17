import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSemantic, generateImageEmbedding, getSearchSuggestions } from '../semantic';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

/** A pristine semantic module: the normalize-once flag is module state, so
 *  tests that assert on it must not inherit it from a sibling test. */
async function freshSemantic() {
  vi.resetModules();
  const mod = await import('../semantic');
  const tauri = await import('../../tauri');
  return { ...mod, invoke: vi.mocked(tauri.invoke) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchSemantic', () => {
  it('returns [] for a blank query without touching the backend', async () => {
    await expect(searchSemantic('   ')).resolves.toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('honours an explicit limit', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'embed_text_cmd') return [1];
      return [];
    });

    await searchSemantic('fox', 5);

    expect(mockInvoke).toHaveBeenCalledWith(
      'search_semantic_cmd',
      expect.objectContaining({ limit: 5 }),
    );
  });
});

describe('embedding normalization (module-level, once per session)', () => {
  it('normalizes legacy embeddings, embeds the query and scales similarity to 0-100', async () => {
    const { searchSemantic: fresh, invoke: inv } = await freshSemantic();
    inv.mockImplementation(async (cmd: string) => {
      if (cmd === 'normalize_embeddings_cmd') return 3;
      if (cmd === 'embed_text_cmd') return [0.1, 0.2, 0.3];
      if (cmd === 'search_semantic_cmd') {
        return [
          { id: 'img-1', similarity: 0.812 },
          { id: 'img-2', similarity: 0.5 },
        ];
      }
      return null;
    });

    const results = await fresh('snowy mountain');

    expect(inv).toHaveBeenNthCalledWith(1, 'normalize_embeddings_cmd');
    expect(inv).toHaveBeenCalledWith('embed_text_cmd', { text: 'snowy mountain' });
    expect(inv).toHaveBeenCalledWith('search_semantic_cmd', {
      queryEmbedding: [0.1, 0.2, 0.3],
      limit: 20,
      minSimilarity: 0,
    });
    expect(results).toEqual([
      { id: 'img-1', similarity: 81 },
      { id: 'img-2', similarity: 50 },
    ]);
  });

  it('normalizes only once per session', async () => {
    const { searchSemantic: fresh, invoke: inv } = await freshSemantic();
    inv.mockImplementation(async (cmd: string) => {
      if (cmd === 'embed_text_cmd') return [1];
      if (cmd === 'search_semantic_cmd') return [];
      return 0;
    });

    await fresh('first');
    await fresh('second');

    expect(inv.mock.calls.filter((c) => c[0] === 'normalize_embeddings_cmd')).toHaveLength(1);
  });

  it('retries normalization after a failure instead of trusting the session flag', async () => {
    const { searchSemantic: fresh, invoke: inv } = await freshSemantic();
    let attempts = 0;
    inv.mockImplementation(async (cmd: string) => {
      if (cmd === 'normalize_embeddings_cmd') {
        attempts++;
        if (attempts === 1) throw new Error('database is locked');
        return 0;
      }
      if (cmd === 'embed_text_cmd') return [1];
      if (cmd === 'search_semantic_cmd') return [];
      return null;
    });

    await expect(fresh('first')).rejects.toThrow('database is locked');
    await expect(fresh('second')).resolves.toEqual([]);

    expect(attempts).toBe(2);
  });
});

describe('generateImageEmbedding', () => {
  it('sends the id and description to the backend', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await generateImageEmbedding('img-1', 'a red fox');

    expect(mockInvoke).toHaveBeenCalledWith('generate_embedding_for_image_cmd', {
      imageId: 'img-1',
      description: 'a red fox',
    });
  });

  it('propagates an embedding failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ollama offline'));

    await expect(generateImageEmbedding('img-1', 'x')).rejects.toThrow('ollama offline');
  });
});

describe('getSearchSuggestions', () => {
  it('returns no suggestions (generated client-side)', async () => {
    await expect(getSearchSuggestions('fox')).resolves.toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
