import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API layer
vi.mock('../../lib/api/ai', () => ({
  analyzeImage: vi.fn(),
  getAnalysisResult: vi.fn(),
  getAnalysisHistory: vi.fn(),
}));

import { useAiAnalysisStore } from '../aiAnalysisStore';
import * as api from '../../lib/api/ai';

const mockAnalyze = vi.mocked(api.analyzeImage);
const mockGetResult = vi.mocked(api.getAnalysisResult);
const mockGetHistory = vi.mocked(api.getAnalysisHistory);

const MOCK_RESULT = {
  description: 'A beautiful landscape',
  tags: [
    { name: 'nature', confidence: 0.95 },
    { name: 'landscape', confidence: 0.90 },
  ],
  objects: ['mountain', 'river'],
  colorPalette: ['#2d4a3e', '#5c7a5e'],
  composition: 'Rule of thirds',
};

const MOCK_HISTORY = [
  {
    id: 'hist-1',
    imageId: 'img-1',
    result: MOCK_RESULT,
    analyzedAt: '2025-01-01T00:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  useAiAnalysisStore.setState({
    results: {},
    history: {},
    analyzingId: null,
    acceptedTags: {},
    rejectedTags: {},
    error: null,
  });
});

describe('analyze', () => {
  it('sets analyzingId and stores result on success', async () => {
    mockAnalyze.mockResolvedValue(MOCK_RESULT);
    mockGetHistory.mockResolvedValue(MOCK_HISTORY);

    await useAiAnalysisStore.getState().analyze('img-1');

    expect(useAiAnalysisStore.getState().analyzingId).toBeNull();
    expect(useAiAnalysisStore.getState().results['img-1']).toEqual(MOCK_RESULT);
    expect(useAiAnalysisStore.getState().error).toBeNull();
  });

  it('sets error on failure', async () => {
    mockAnalyze.mockRejectedValue(new Error('Ollama not available'));

    await useAiAnalysisStore.getState().analyze('img-1');

    expect(useAiAnalysisStore.getState().analyzingId).toBeNull();
    expect(useAiAnalysisStore.getState().error).toBe('Ollama not available');
  });

  it('sets analyzingId during analysis', async () => {
    mockAnalyze.mockImplementation(() => new Promise(() => {})); // Never resolves

    useAiAnalysisStore.getState().analyze('img-1');

    expect(useAiAnalysisStore.getState().analyzingId).toBe('img-1');
  });
});

describe('loadResult', () => {
  it('loads result from API', async () => {
    mockGetResult.mockResolvedValue(MOCK_RESULT);

    await useAiAnalysisStore.getState().loadResult('img-1');

    expect(useAiAnalysisStore.getState().results['img-1']).toEqual(MOCK_RESULT);
  });

  it('does nothing when result is null', async () => {
    mockGetResult.mockResolvedValue(null);

    await useAiAnalysisStore.getState().loadResult('img-1');

    expect(useAiAnalysisStore.getState().results['img-1']).toBeUndefined();
  });
});

describe('loadHistory', () => {
  it('loads history from API', async () => {
    mockGetHistory.mockResolvedValue(MOCK_HISTORY);

    await useAiAnalysisStore.getState().loadHistory('img-1');

    expect(useAiAnalysisStore.getState().history['img-1']).toEqual(MOCK_HISTORY);
  });
});

describe('acceptTag', () => {
  it('adds tag to accepted list', () => {
    useAiAnalysisStore.getState().acceptTag('img-1', 'nature');

    expect(useAiAnalysisStore.getState().acceptedTags['img-1']).toEqual(['nature']);
  });

  it('does not duplicate tags', () => {
    useAiAnalysisStore.getState().acceptTag('img-1', 'nature');
    useAiAnalysisStore.getState().acceptTag('img-1', 'nature');

    expect(useAiAnalysisStore.getState().acceptedTags['img-1']).toEqual(['nature']);
  });
});

describe('rejectTag', () => {
  it('adds tag to rejected list', () => {
    useAiAnalysisStore.getState().rejectTag('img-1', 'blurry');

    expect(useAiAnalysisStore.getState().rejectedTags['img-1']).toEqual(['blurry']);
  });

  it('does not duplicate tags', () => {
    useAiAnalysisStore.getState().rejectTag('img-1', 'blurry');
    useAiAnalysisStore.getState().rejectTag('img-1', 'blurry');

    expect(useAiAnalysisStore.getState().rejectedTags['img-1']).toEqual(['blurry']);
  });
});

describe('clearResult', () => {
  it('removes result for image', () => {
    useAiAnalysisStore.setState({
      results: { 'img-1': MOCK_RESULT },
    });

    useAiAnalysisStore.getState().clearResult('img-1');

    expect(useAiAnalysisStore.getState().results['img-1']).toBeUndefined();
  });
});
