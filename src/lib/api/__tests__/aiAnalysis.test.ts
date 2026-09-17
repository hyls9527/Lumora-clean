import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImage, getAnalysisResult, getAnalysisHistory } from '../ai';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeImage', () => {
  it('sends the image id/path/model and converts snake_case keys to camelCase', async () => {
    mockInvoke.mockResolvedValueOnce({
      description: 'a red fox in snow',
      tags: [{ name: 'animal', confidence: 0.91 }],
      objects: ['fox'],
      color_palette: ['#ffffff', '#b33a3a'],
      composition: 'centered',
    });

    const result = await analyzeImage('img-1', 'C:/lib/fox.png', 'llava');

    expect(mockInvoke).toHaveBeenCalledWith('analyze_image_cmd', {
      imageId: 'img-1',
      imagePath: 'C:/lib/fox.png',
      model: 'llava',
    });
    expect(result).toEqual({
      description: 'a red fox in snow',
      tags: [{ name: 'animal', confidence: 0.91 }],
      objects: ['fox'],
      colorPalette: ['#ffffff', '#b33a3a'],
      composition: 'centered',
    });
  });

  it('defaults the path to an empty string and the model to undefined', async () => {
    mockInvoke.mockResolvedValueOnce({});

    await analyzeImage('img-2');

    expect(mockInvoke).toHaveBeenCalledWith('analyze_image_cmd', {
      imageId: 'img-2',
      imagePath: '',
      model: undefined,
    });
  });

  it('falls back to empty values when the backend omits fields', async () => {
    mockInvoke.mockResolvedValueOnce({ description: null, tags: null, colorPalette: null });

    const result = await analyzeImage('img-3');

    expect(result).toEqual({
      description: '',
      tags: [],
      objects: [],
      colorPalette: [],
      composition: '',
    });
  });

  it('converts keys inside nested objects and arrays', async () => {
    mockInvoke.mockResolvedValueOnce({
      description: 'x',
      tags: [{ name: 'a', confidence: 1, extra_field: 'kept' }],
      objects: [],
      colorPalette: [],
      composition: '',
    });

    const result = await analyzeImage('img-4');

    expect(result.tags[0]).toEqual({ name: 'a', confidence: 1, extraField: 'kept' });
  });
});

describe('getAnalysisResult', () => {
  it('returns null when the backend has no analysis for the image', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    expect(await getAnalysisResult('img-1')).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('get_analysis_result_cmd', { imageId: 'img-1' });
  });

  it('normalizes a stored analysis result', async () => {
    mockInvoke.mockResolvedValueOnce({
      description: 'stored',
      tags: [],
      objects: [],
      color_palette: ['#000000'],
      composition: 'rule of thirds',
    });

    const result = await getAnalysisResult('img-1');

    expect(result).toEqual({
      description: 'stored',
      tags: [],
      objects: [],
      colorPalette: ['#000000'],
      composition: 'rule of thirds',
    });
  });
});

describe('getAnalysisHistory', () => {
  it('maps backend history rows onto AnalysisHistoryItem', async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        id: 'h1',
        image_id: 'img-1',
        analyzed_at: '2025-01-01T00:00:00Z',
        result: {
          description: 'first pass',
          tags: [{ name: 'cat', confidence: 0.8 }],
          objects: ['cat'],
          color_palette: ['#fff'],
          composition: 'center',
        },
      },
    ]);

    const history = await getAnalysisHistory('img-1');

    expect(mockInvoke).toHaveBeenCalledWith('get_analysis_history_cmd', { imageId: 'img-1' });
    expect(history).toEqual([
      {
        id: 'h1',
        imageId: 'img-1',
        analyzedAt: '2025-01-01T00:00:00Z',
        result: {
          description: 'first pass',
          tags: [{ name: 'cat', confidence: 0.8 }],
          objects: ['cat'],
          colorPalette: ['#fff'],
          composition: 'center',
        },
      },
    ]);
  });

  it('returns an empty list when the backend has no history', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    expect(await getAnalysisHistory('img-1')).toEqual([]);
  });
});
