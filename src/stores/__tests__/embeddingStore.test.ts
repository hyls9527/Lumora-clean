import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API layer
vi.mock('../../lib/api/embeddings', () => ({
  getEmbeddingStatus: vi.fn(),
  getEmbeddingStats: vi.fn(),
  generateEmbeddings: vi.fn(),
}));

import { useEmbeddingStore } from '../embeddingStore';
import * as api from '../../lib/api/embeddings';

const mockGetStatus = vi.mocked(api.getEmbeddingStatus);
const mockGetStats = vi.mocked(api.getEmbeddingStats);
const mockGenerate = vi.mocked(api.generateEmbeddings);

beforeEach(() => {
  vi.clearAllMocks();
  useEmbeddingStore.setState({
    statusMap: {},
    stats: null,
    statsLoading: false,
    generating: false,
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
    const stats = { embedded: 10, pending: 2, error: 1, total: 13 };
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
    mockGetStats.mockResolvedValue({ embedded: 5, pending: 0, error: 0, total: 5 });

    await useEmbeddingStore.getState().generate(['img-1', 'img-2']);

    expect(useEmbeddingStore.getState().generating).toBe(false);
    expect(mockGenerate).toHaveBeenCalledWith(['img-1', 'img-2']);
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(mockGetStats).toHaveBeenCalled();
  });
});
