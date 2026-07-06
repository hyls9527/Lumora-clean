import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchAutoTag } from '../ai';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

describe('batchAutoTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze and apply tags for each image', async () => {
    // analyze_image_cmd returns analysis result
    mockInvoke.mockResolvedValueOnce({
      description: 'a cat',
      tags: [{ name: 'animal', confidence: 0.9 }],
      objects: ['cat'],
      colorPalette: ['#fff'],
      composition: 'center',
    });
    // apply_ai_tags_cmd returns applied count
    mockInvoke.mockResolvedValueOnce(1);

    const result = await batchAutoTag(['img-1']);

    expect(mockInvoke).toHaveBeenCalledWith('analyze_image_cmd', { imageId: 'img-1' });
    expect(mockInvoke).toHaveBeenCalledWith('apply_ai_tags_cmd', { imageId: 'img-1' });
    expect(result).toEqual({ processed: 1, failed: 0 });
  });

  it('should process multiple images sequentially', async () => {
    mockInvoke.mockResolvedValue({
      description: 'test',
      tags: [{ name: 'tag', confidence: 0.8 }],
      objects: [],
      colorPalette: [],
      composition: '',
    });

    const onProgress = vi.fn();
    await batchAutoTag(['img-1', 'img-2', 'img-3'], onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledWith({ current: 1, total: 3, imageId: 'img-1' });
    expect(onProgress).toHaveBeenCalledWith({ current: 2, total: 3, imageId: 'img-2' });
    expect(onProgress).toHaveBeenCalledWith({ current: 3, total: 3, imageId: 'img-3' });
  });

  it('should skip failed images and continue', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Ollama offline'));
    mockInvoke.mockResolvedValueOnce({
      description: 'ok',
      tags: [],
      objects: [],
      colorPalette: [],
      composition: '',
    });

    const result = await batchAutoTag(['img-1', 'img-2']);

    expect(result).toEqual({ processed: 1, failed: 1 });
  });

  it('should return zeros for empty input', async () => {
    const result = await batchAutoTag([]);
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should call onProgress with failure info on error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('timeout'));

    const onProgress = vi.fn();
    await batchAutoTag(['img-1'], onProgress);

    expect(onProgress).toHaveBeenCalledWith({
      current: 1,
      total: 1,
      imageId: 'img-1',
      error: 'timeout',
    });
  });
});
