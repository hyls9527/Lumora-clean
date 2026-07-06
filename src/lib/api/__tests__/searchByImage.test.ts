import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchByImage } from '../semantic';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

describe('searchByImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call clip_embed_image_cmd with file path', async () => {
    mockInvoke.mockResolvedValueOnce([0.1, 0.2, 0.3]); // embedding
    mockInvoke.mockResolvedValueOnce([{ id: 'img-2', similarity: 0.9 }]); // results

    await searchByImage('/path/to/image.png');

    expect(mockInvoke).toHaveBeenCalledWith('clip_embed_image_cmd', {
      imagePath: '/path/to/image.png',
    });
  });

  it('should search with the generated embedding', async () => {
    const embedding = [0.1, 0.2, 0.3];
    mockInvoke.mockResolvedValueOnce(embedding);
    mockInvoke.mockResolvedValueOnce([{ id: 'img-2', similarity: 0.85 }]);

    await searchByImage('/path/to/image.png', 10);

    expect(mockInvoke).toHaveBeenCalledWith('search_semantic_cmd', {
      queryEmbedding: embedding,
      limit: 10,
    });
  });

  it('should return results with similarity as percentage', async () => {
    mockInvoke.mockResolvedValueOnce([0.1, 0.2]);
    mockInvoke.mockResolvedValueOnce([
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
    mockInvoke.mockResolvedValueOnce([0.1, 0.2]);
    mockInvoke.mockResolvedValueOnce([
      { id: 'img-1', similarity: 1.0 },
      { id: 'img-2', similarity: 0.85 },
    ]);

    const results = await searchByImage('/path/to/image.png', 20, 'img-1');

    expect(results).toEqual([{ id: 'img-2', similarity: 85 }]);
  });

  it('should default limit to 20', async () => {
    mockInvoke.mockResolvedValueOnce([0.1]);
    mockInvoke.mockResolvedValueOnce([]);

    await searchByImage('/path/to/image.png');

    expect(mockInvoke).toHaveBeenCalledWith('search_semantic_cmd', {
      queryEmbedding: [0.1],
      limit: 20,
    });
  });
});
