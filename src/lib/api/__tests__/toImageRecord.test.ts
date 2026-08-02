import { describe, it, expect } from 'vitest';
import { toImageRecord, type TauriImageRecord } from '../images';

describe('toImageRecord', () => {
  const raw: TauriImageRecord = {
    id: 'img-1',
    filePath: '/path/to/image.png',
    fileHash: 'abc123',
    fileSizeKb: 1024,
    width: 512,
    height: 512,
    format: 'png',
    createdAt: '2026-01-01T00:00:00Z',
    importedAt: '2026-01-01T00:00:00Z',
    deleted: false,
    deletedAt: null,
    rating: 3,
    favorite: true,
    metadataJson: '{"model":"SDXL","prompt":"a cat","tags":["animal","cat"],"negative_prompt":"blurry","steps":20,"sampler":"Euler a","cfg_scale":7.5,"seed":12345}',
  };

  it('should extract model, prompt, tags from metadataJson', () => {
    const result = toImageRecord(raw);
    expect(result.model).toBe('SDXL');
    expect(result.prompt).toBe('a cat');
    expect(result.tags).toEqual(['animal', 'cat']);
  });

  it('should extract SD parameters from metadataJson', () => {
    const result = toImageRecord(raw);
    expect(result.negativePrompt).toBe('blurry');
    expect(result.steps).toBe(20);
    expect(result.sampler).toBe('Euler a');
    expect(result.cfgScale).toBe(7.5);
    expect(result.seed).toBe(12345);
  });

  it('should handle metadataJson without SD parameters', () => {
    const result = toImageRecord({
      ...raw,
      metadataJson: '{"model":"SDXL","prompt":"a cat","tags":["animal"]}',
    });
    expect(result.model).toBe('SDXL');
    expect(result.prompt).toBe('a cat');
    expect(result.negativePrompt).toBeUndefined();
    expect(result.steps).toBeUndefined();
    expect(result.sampler).toBeUndefined();
    expect(result.cfgScale).toBeUndefined();
    expect(result.seed).toBeUndefined();
  });

  it('should map basic fields correctly', () => {
    const result = toImageRecord(raw);
    expect(result.id).toBe('img-1');
    expect(result.filePath).toBe('/path/to/image.png');
    expect(result.fileSizeKb).toBe(1024);
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.rating).toBe(3);
    expect(result.favorite).toBe(true);
  });

  it('should extract fileName from filePath', () => {
    const result = toImageRecord(raw);
    expect(result.fileName).toBe('image.png');
  });

  it('should handle null metadataJson', () => {
    const result = toImageRecord({ ...raw, metadataJson: null });
    expect(result.model).toBe('');
    expect(result.prompt).toBe('');
    expect(result.tags).toEqual([]);
    expect(result.negativePrompt).toBeUndefined();
    expect(result.steps).toBeUndefined();
    expect(result.sampler).toBeUndefined();
    expect(result.cfgScale).toBeUndefined();
    expect(result.seed).toBeUndefined();
  });

  it('should handle null width/height', () => {
    const result = toImageRecord({ ...raw, width: null, height: null });
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('should handle deletedAt', () => {
    const result = toImageRecord({ ...raw, deletedAt: '2026-06-01' });
    expect(result.deletedAt).toBe('2026-06-01');
  });

  it('should handle null deletedAt', () => {
    const result = toImageRecord({ ...raw, deletedAt: null });
    expect(result.deletedAt).toBeUndefined();
  });
});
