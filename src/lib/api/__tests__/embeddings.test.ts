import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEmbeddingStatus,
  generateEmbeddings,
  getEmbeddingStats,
  embedMissing,
  getClipEmbeddingStats,
  embedClipMissing,
} from '../embeddings';
import type { ImageRecord } from '../../../types/image';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

function image(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    id: 'img-1',
    filePath: 'C:/lib/a.png',
    fileName: 'a.png',
    fileSizeKb: 10,
    width: 512,
    height: 512,
    format: 'png',
    createdAt: '2025-01-01',
    rating: 0,
    favorite: false,
    model: '',
    prompt: '',
    tags: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEmbeddingStatus', () => {
  it('maps a present row onto status/dimensions/generatedAt', async () => {
    mockInvoke.mockResolvedValueOnce({
      status: 'embedded',
      dimensions: 768,
      generatedAt: '2025-01-02T03:04:05Z',
    });

    const info = await getEmbeddingStatus('img-1');

    expect(mockInvoke).toHaveBeenCalledWith('get_embedding_status_cmd', { imageId: 'img-1' });
    expect(info).toEqual({
      status: 'embedded',
      dimensions: 768,
      generatedAt: '2025-01-02T03:04:05Z',
    });
  });

  it('reports pending when the backend has no embedding row', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    expect(await getEmbeddingStatus('img-9')).toEqual({ status: 'pending' });
  });

  it('normalizes null dimensions/generatedAt to undefined', async () => {
    mockInvoke.mockResolvedValueOnce({ status: 'error', dimensions: null, generatedAt: null });

    const info = await getEmbeddingStatus('img-1');

    expect(info.status).toBe('error');
    expect(info.dimensions).toBeUndefined();
    expect(info.generatedAt).toBeUndefined();
  });
});

describe('generateEmbeddings', () => {
  it('uses prompt, then fileName, then id as the description', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await generateEmbeddings([
      image({ id: 'i1', prompt: 'a red fox', fileName: 'fox.png' }),
      image({ id: 'i2', prompt: '', fileName: 'cat.png' }),
      image({ id: 'i3', prompt: '', fileName: '' }),
    ]);

    expect(mockInvoke).toHaveBeenCalledWith('generate_embedding_for_image_cmd', {
      imageId: 'i1',
      description: 'a red fox',
    });
    expect(mockInvoke).toHaveBeenCalledWith('generate_embedding_for_image_cmd', {
      imageId: 'i2',
      description: 'cat.png',
    });
    expect(mockInvoke).toHaveBeenCalledWith('generate_embedding_for_image_cmd', {
      imageId: 'i3',
      description: 'i3',
    });
  });

  it('never runs more than 3 embeds at a time and still finishes the tail batch', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const release: Array<() => void> = [];
    mockInvoke.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          release.push(() => {
            inFlight--;
            resolve();
          });
        }),
    );

    const done = generateEmbeddings([1, 2, 3, 4, 5].map((n) => image({ id: 'i' + n })));

    // The first batch is issued synchronously; the 4th waits for a free slot.
    expect(mockInvoke).toHaveBeenCalledTimes(3);

    release.splice(0).forEach((r) => r());
    await vi.waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(5));

    release.splice(0).forEach((r) => r());
    await done;

    expect(maxInFlight).toBe(3);
    expect(mockInvoke).toHaveBeenCalledTimes(5);
  });

  it('resolves without any invocation for an empty list', async () => {
    await generateEmbeddings([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('getEmbeddingStats', () => {
  it('passes through the backend counters', async () => {
    mockInvoke.mockResolvedValueOnce({ embedded: 4, pending: 2, error: 1, total: 7, missing: 3 });

    expect(await getEmbeddingStats()).toEqual({
      embedded: 4,
      pending: 2,
      error: 1,
      total: 7,
      missing: 3,
    });
    expect(mockInvoke).toHaveBeenCalledWith('get_embedding_stats_cmd');
  });

  it('defaults every counter to 0 when the backend omits fields', async () => {
    mockInvoke.mockResolvedValueOnce({});

    expect(await getEmbeddingStats()).toEqual({
      embedded: 0,
      pending: 0,
      error: 0,
      total: 0,
      missing: 0,
    });
  });
});

describe('embedMissing', () => {
  it('forwards the limit and returns the batch result', async () => {
    mockInvoke.mockResolvedValueOnce({ processed: 10, remaining: 5 });

    expect(await embedMissing(25)).toEqual({ processed: 10, remaining: 5 });
    expect(mockInvoke).toHaveBeenCalledWith('embed_missing_cmd', { limit: 25 });
  });

  it('defaults the limit to 10', async () => {
    mockInvoke.mockResolvedValueOnce({ processed: 1, remaining: 0 });

    await embedMissing();

    expect(mockInvoke).toHaveBeenCalledWith('embed_missing_cmd', { limit: 10 });
  });

  it('returns zeros when the backend returns nothing', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    expect(await embedMissing()).toEqual({ processed: 0, remaining: 0 });
  });
});

describe('getClipEmbeddingStats', () => {
  it('passes through the CLIP index counters', async () => {
    mockInvoke.mockResolvedValueOnce({ embedded: 9, error: 0, total: 9, missing: 1 });

    expect(await getClipEmbeddingStats()).toEqual({
      embedded: 9,
      error: 0,
      total: 9,
      missing: 1,
    });
    expect(mockInvoke).toHaveBeenCalledWith('get_clip_embedding_stats_cmd');
  });

  it('returns zeros when the backend returns nothing', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    expect(await getClipEmbeddingStats()).toEqual({
      embedded: 0,
      error: 0,
      total: 0,
      missing: 0,
    });
  });
});

describe('embedClipMissing', () => {
  it('forwards the limit and returns the batch result', async () => {
    mockInvoke.mockResolvedValueOnce({ processed: 3, remaining: 7 });

    expect(await embedClipMissing(3)).toEqual({ processed: 3, remaining: 7 });
    expect(mockInvoke).toHaveBeenCalledWith('embed_clip_missing_cmd', { limit: 3 });
  });

  it('defaults the limit to 10 and tolerates a null result', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    expect(await embedClipMissing()).toEqual({ processed: 0, remaining: 0 });
    expect(mockInvoke).toHaveBeenCalledWith('embed_clip_missing_cmd', { limit: 10 });
  });
});
