import { describe, it, expect, vi } from 'vitest';
import { toImageRecord, type TauriImageRecord } from '../images';

/**
 * Type contract test: ensures Rust ImageRecord field names and their
 * TypeScript camelCase equivalents stay in sync.
 */

// Mock tauri invoke so images.ts can import cleanly
vi.mock('../../lib/tauri', () => ({
  invoke: vi.fn(),
  isTauriAvailable: false,
}));

const RUST_IMAGE_RECORD_FIELDS = [
  'id',
  'file_path',
  'file_hash',
  'file_size_kb',
  'width',
  'height',
  'format',
  'created_at',
  'imported_at',
  'deleted',
  'rating',
  'favorite',
  'metadata_json',
  'deleted_at',
  'hps_score',
  'hps_style',
  'aesthetic_score',
  'scoring_model',
  'scored_at',
  'score_label',
] as const;

const TS_IMAGE_RECORD_FIELDS = [
  'id',
  'filePath',
  'fileHash',
  'fileSizeKb',
  'width',
  'height',
  'format',
  'createdAt',
  'importedAt',
  'deleted',
  'rating',
  'favorite',
  'metadataJson',
  'deletedAt',
  'hpsScore',
  'hpsStyle',
  'aestheticScore',
  'scoringModel',
  'scoredAt',
  'scoreLabel',
] as const;

/** Convert snake_case to camelCase (mirrors the logic in ai.ts). */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

describe('ImageRecord type contract', () => {
  it('Rust and TS field arrays have the same length', () => {
    expect(RUST_IMAGE_RECORD_FIELDS).toHaveLength(TS_IMAGE_RECORD_FIELDS.length);
  });

  it('snakeToCamel(RUST fields) === TS fields', () => {
    const converted = RUST_IMAGE_RECORD_FIELDS.map(snakeToCamel);
    expect(converted).toEqual([...TS_IMAGE_RECORD_FIELDS]);
  });
});

// ---------------------------------------------------------------------------
// toImageRecord conversion tests
// ---------------------------------------------------------------------------

const MOCK_TAURI_RECORD: TauriImageRecord = {
  id: 'test-id-001',
  filePath: '/path/to/image.png',
  fileHash: 'abc123',
  fileSizeKb: 1024,
  width: 1920,
  height: 1080,
  format: 'png',
  createdAt: '2024-01-01T00:00:00Z',
  importedAt: '2024-01-02T00:00:00Z',
  deleted: false,
  deletedAt: null,
  rating: 3,
  favorite: true,
  metadataJson: JSON.stringify({ model: 'SDXL', prompt: 'a cat on mars', tags: ['animal', 'space'], negative_prompt: 'ugly', steps: 30, sampler: 'euler', cfg_scale: 8.0, seed: 999 }),
  hpsScore: 27.3,
  hpsStyle: 'Animation',
  aestheticScore: 8.7,
  scoringModel: 'test@v1',
  scoredAt: '2024-01-03T00:00:00Z',
  scoreLabel: '夯',
};

describe('toImageRecord conversion', () => {
  it('maps all TauriImageRecord fields to ImageRecord', () => {
    const result = toImageRecord(MOCK_TAURI_RECORD);
    expect(result.id).toBe('test-id-001');
    expect(result.filePath).toBe('/path/to/image.png');
    expect(result.fileName).toBe('image.png');
    expect(result.fileSizeKb).toBe(1024);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.format).toBe('png');
    expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(result.rating).toBe(3);
    expect(result.favorite).toBe(true);
    expect(result.model).toBe('SDXL');
    expect(result.prompt).toBe('a cat on mars');
    expect(result.tags).toEqual(['animal', 'space']);
    expect(result.negativePrompt).toBe('ugly');
    expect(result.steps).toBe(30);
    expect(result.sampler).toBe('euler');
    expect(result.cfgScale).toBe(8.0);
    expect(result.seed).toBe(999);
    expect(result.hpsScore).toBe(27.3);
    expect(result.hpsStyle).toBe('Animation');
    expect(result.aestheticScore).toBe(8.7);
    expect(result.scoringModel).toBe('test@v1');
    expect(result.scoredAt).toBe('2024-01-03T00:00:00Z');
    expect(result.scoreLabel).toBe('夯');
  });

  it('maps null score fields to undefined', () => {
    const result = toImageRecord({
      ...MOCK_TAURI_RECORD,
      hpsScore: null,
      aestheticScore: null,
      scoreLabel: null,
    });
    expect(result.hpsScore).toBeUndefined();
    expect(result.aestheticScore).toBeUndefined();
    expect(result.scoreLabel).toBeUndefined();
    expect(result.hpsStyle).toBe('Animation');
  });

  it('handles null metadataJson gracefully', () => {
    const result = toImageRecord({ ...MOCK_TAURI_RECORD, metadataJson: null });
    expect(result.model).toBe('');
    expect(result.prompt).toBe('');
    expect(result.tags).toEqual([]);
    expect(result.negativePrompt).toBeUndefined();
    expect(result.steps).toBeUndefined();
  });

  it('handles null width/height → 0', () => {
    const result = toImageRecord({ ...MOCK_TAURI_RECORD, width: null, height: null });
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('preserves deletedAt when present', () => {
    const result = toImageRecord({ ...MOCK_TAURI_RECORD, deletedAt: '2024-06-01T12:00:00Z' });
    expect(result.deletedAt).toBe('2024-06-01T12:00:00Z');
  });

  it('sets deletedAt to undefined when null', () => {
    const result = toImageRecord(MOCK_TAURI_RECORD);
    expect(result.deletedAt).toBeUndefined();
  });

  it('extracts fileName from Windows-style path', () => {
    const result = toImageRecord({ ...MOCK_TAURI_RECORD, filePath: 'C:\\Users\\test\\image.jpg' });
    expect(result.fileName).toBe('image.jpg');
  });

  it('extracts fileName from Unix-style path', () => {
    const result = toImageRecord({ ...MOCK_TAURI_RECORD, filePath: '/home/user/image.webp' });
    expect(result.fileName).toBe('image.webp');
  });

  it('handles malformed metadataJson without throwing', () => {
    const result = toImageRecord({ ...MOCK_TAURI_RECORD, metadataJson: 'not-json' });
    expect(result.model).toBe('');
    expect(result.prompt).toBe('');
    expect(result.tags).toEqual([]);
    expect(result.negativePrompt).toBeUndefined();
    expect(result.seed).toBeUndefined();
  });
});
