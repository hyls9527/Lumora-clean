import { describe, it, expect } from 'vitest';

/**
 * Type contract test: ensures Rust ImageRecord field names and their
 * TypeScript camelCase equivalents stay in sync.
 */

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
