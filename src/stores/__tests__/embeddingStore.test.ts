import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API layer
vi.mock('../../lib/api/embeddings', () => ({
  getEmbeddingStatus: vi.fn(),
  getEmbeddingStats: vi.fn(),
  generateEmbeddings: vi.fn(),
  embedMissing: vi.fn(),
}));

import { useEmbeddingStore } from '../embeddingStore';
import * as api from '../../lib/api/embeddings';
import type { ImageRecord } from '../imageStore';

const mockGetStatus = vi.mocked(api.getEmbeddingStatus);
const mockGetStats = vi.mocked(api.getEmbeddingStats);
const mockGenerate = vi.mocked(api.generateEmbeddings);
const mockEmbedMissing = vi.mocked(api.embedMissing);

beforeEach(() => {
  vi.clearAllMocks();
  useEmbeddingStore.setState({
    statusMap: {},
    stats: null,
    statsLoading: false,
    generating: false,
    filling: false,
    fillProgress: null,
  });
});

describe('fetchStatus', () => {
  it('fetches and stores embedding status', async () => {
    mockGetStatus.mockResolvedValue({ status: 'embedded', dimensions: 512, generatedAt: '2025-01-01' });

    await useEmbeddingStore.getState().fetchStatus('img-1');

    expect(mockGetStatus).toHaveBeenCalledWith('img-1');
    expect(useEmbeddingStore.getState().statusMap['img-1']).toEqual({
      status: 'embedded',
      dimensions: 512,
      generatedAt: '2025-01-01',
    });
  });

  it('handles pending status', async () => {
    mockGetStatus.mockResolvedValue({ status: 'pending' });

    await useEmbeddingStore.getState().fetchStatus('img-2');

    expect(useEmbeddingStore.getState().statusMap['img-2'].status).toBe('pending');
  });
});

describe('fetchStatuses', () => {
  it('fetches multiple statuses in parallel', async () => {
    mockGetStatus
      .mockResolvedValueOnce({ status: 'embedded', dimensions: 512 })
      .mockResolvedValueOnce({ status: 'pending' });

    await useEmbeddingStore.getState().fetchStatuses(['img-1', 'img-2']);

    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(useEmbeddingStore.getState().statusMap['img-1'].status).toBe('embedded');
    expect(useEmbeddingStore.getState().statusMap['img-2'].status).toBe('pending');
  });

  it('does nothing for empty array', async () => {
    await useEmbeddingStore.getState().fetchStatuses([]);

    expect(mockGetStatus).not.toHaveBeenCalled();
  });
});

describe('fetchStats', () => {
  it('fetches and stores stats', async () => {
    const stats = { embedded: 10, pending: 2, error: 1, total: 13, missing: 0 };
    mockGetStats.mockResolvedValue(stats);

    await useEmbeddingStore.getState().fetchStats();

    expect(useEmbeddingStore.getState().stats).toEqual(stats);
    expect(useEmbeddingStore.getState().statsLoading).toBe(false);
  });

  it('sets loading state', async () => {
    mockGetStats.mockImplementation(() => new Promise(() => {})); // Never resolves

    useEmbeddingStore.getState().fetchStats();
    expect(useEmbeddingStore.getState().statsLoading).toBe(true);
  });
});

describe('generate', () => {
  it('sets generating flag and refreshes statuses', async () => {
    mockGenerate.mockResolvedValue(undefined);
    mockGetStatus.mockResolvedValue({ status: 'embedded', dimensions: 512 });
    mockGetStats.mockResolvedValue({ embedded: 5, pending: 0, error: 0, total: 5, missing: 0 });

    const testImages: ImageRecord[] = [
      { id: 'img-1', prompt: 'a cat', fileName: 'cat.png', filePath: '/cat.png', fileSizeKb: 100, width: 512, height: 512, format: 'png', createdAt: '2025-01-01', rating: 0, favorite: false, model: '', tags: [] },
      { id: 'img-2', prompt: 'a dog', fileName: 'dog.png', filePath: '/dog.png', fileSizeKb: 200, width: 512, height: 512, format: 'png', createdAt: '2025-01-01', rating: 0, favorite: false, model: '', tags: [] },
    ];
    await useEmbeddingStore.getState().generate(testImages);

    expect(useEmbeddingStore.getState().generating).toBe(false);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'img-1', prompt: 'a cat' }),
        expect.objectContaining({ id: 'img-2', prompt: 'a dog' }),
      ]),
    );
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(mockGetStats).toHaveBeenCalled();
  });

  it('sets error on failure', async () => {
    mockGenerate.mockRejectedValue(new Error('generate failed'));
    const testImages: ImageRecord[] = [
      { id: 'img-1', prompt: 'a cat', fileName: 'cat.png', filePath: '/cat.png', fileSizeKb: 100, width: 512, height: 512, format: 'png', createdAt: '2025-01-01', rating: 0, favorite: false, model: '', tags: [] },
    ];
    await useEmbeddingStore.getState().generate(testImages);

    expect(useEmbeddingStore.getState().error).toBe('generate failed');
    expect(useEmbeddingStore.getState().generating).toBe(false);
  });
});

describe('fetchStats error handling', () => {
  it('sets error on failure', async () => {
    mockGetStats.mockRejectedValue(new Error('stats failed'));
    await useEmbeddingStore.getState().fetchStats();

    expect(useEmbeddingStore.getState().error).toBe('stats failed');
    expect(useEmbeddingStore.getState().statsLoading).toBe(false);
  });
});

describe('fillMissing', () => {
  it('loops until all missing embeddings are generated', async () => {
    mockEmbedMissing
      .mockResolvedValueOnce({ processed: 5, remaining: 3 })
      .mockResolvedValueOnce({ processed: 3, remaining: 0 });
    mockGetStats.mockResolvedValue({ embedded: 8, pending: 0, error: 0, total: 8, missing: 0 });

    await useEmbeddingStore.getState().fillMissing(5);

    expect(mockEmbedMissing).toHaveBeenCalledTimes(2);
    expect(mockEmbedMissing).toHaveBeenCalledWith(5);
    expect(useEmbeddingStore.getState().filling).toBe(false);
    expect(useEmbeddingStore.getState().fillProgress).toBeNull();
    expect(useEmbeddingStore.getState().stats?.embedded).toBe(8);
  });

  it('stops on error and reports it', async () => {
    mockEmbedMissing.mockRejectedValue(new Error('ollama offline'));

    await useEmbeddingStore.getState().fillMissing(5);

    expect(useEmbeddingStore.getState().error).toBe('ollama offline');
    expect(useEmbeddingStore.getState().filling).toBe(false);
  });
});
