import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchByImage } from '../semantic';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

function setupMocks(embedding: number[], results: { id: string; similarity: number }[]) {
  mockInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'normalize_embeddings_cmd') return 0;
    if (cmd === 'clip_embed_image_cmd') return embedding;
    if (cmd === 'search_semantic_image_cmd') return results;
    return null;
  });
}

describe('searchByImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should normalize legacy embeddings before searching', async () => {
    setupMocks([0.1, 0.2, 0.3], []);

    await searchByImage('/path/to/image.png');

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'normalize_embeddings_cmd');
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'clip_embed_image_cmd', {
      imagePath: '/path/to/image.png',
    });
  });

  it('should call clip_embed_image_cmd with file path', async () => {
    setupMocks([0.1, 0.2, 0.3], []);

    await searchByImage('/path/to/image.png');

    expect(mockInvoke).toHaveBeenCalledWith('clip_embed_image_cmd', {
      imagePath: '/path/to/image.png',
    });
  });

  it('should search with the generated embedding', async () => {
    const embedding = [0.1, 0.2, 0.3];
    setupMocks(embedding, [{ id: 'img-2', similarity: 0.85 }]);

    await searchByImage('/path/to/image.png', 10);

    expect(mockInvoke).toHaveBeenCalledWith('search_semantic_image_cmd', {
      queryEmbedding: embedding,
      limit: 10,
      minSimilarity: 0,
    });
  });

  it('should return results with similarity as percentage', async () => {
    setupMocks([0.1, 0.2], [
      { id: 'img-2', similarity: 0.85 },
      { id: 'img-3', similarity: 0.72 },
    ]);

    const results = await searchByImage('/path/to/image.png');

    expect(results).toEqual([
      { id: 'img-2', similarity: 85 },
      { id: 'img-3', similarity: 72 },
    ]);
  });

  it('should exclude the source image from results', async () => {
    setupMocks([0.1, 0.2], [
      { id: 'img-1', similarity: 1.0 },
      { id: 'img-2', similarity: 0.85 },
    ]);

    const results = await searchByImage('/path/to/image.png', 20, 'img-1');

    expect(results).toEqual([{ id: 'img-2', similarity: 85 }]);
  });

  it('should default limit to 20', async () => {
    setupMocks([0.1], []);

    await searchByImage('/path/to/image.png');

    expect(mockInvoke).toHaveBeenCalledWith('search_semantic_image_cmd', {
      queryEmbedding: [0.1],
      limit: 20,
      minSimilarity: 0,
    });
  });

});
