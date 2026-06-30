/**
 * Embedding API — delegates to real Tauri commands.
 */

import { invoke } from '../tauri';
import type { ImageRecord } from '../../types/image';

export type EmbeddingStatus = 'embedded' | 'pending' | 'error';

export interface EmbeddingInfo {
  status: EmbeddingStatus;
  dimensions?: number;
  generatedAt?: string;
}

export interface EmbeddingStats {
  embedded: number;
  pending: number;
  error: number;
  total: number;
}

/**
 * Get embedding status for a single image.
 * Calls Tauri command `get_embedding_status_cmd`.
 */
export async function getEmbeddingStatus(
  imageId: string,
): Promise<EmbeddingInfo> {
  const result = await invoke<EmbeddingInfo | null>('get_embedding_status_cmd', { imageId });
  if (result) {
    return {
      status: result.status as EmbeddingStatus,
      dimensions: result.dimensions ?? undefined,
      generatedAt: result.generatedAt ?? undefined,
    };
  }
  return { status: 'pending' };
}

/**
 * Generate embeddings for a list of images.
 * Uses the image's prompt (from metadata) as description, falls back to filename.
 * Calls Tauri command `generate_embedding_for_image_cmd` per image.
 */
export async function generateEmbeddings(
  images: ImageRecord[],
): Promise<void> {
  const CONCURRENCY = 3;
  const results: Promise<void>[] = [];
  for (const img of images) {
    const description = img.prompt || img.fileName || img.id;
    const p = invoke('generate_embedding_for_image_cmd', {
      imageId: img.id,
      description,
    }).then(() => {});
    results.push(p);
    if (results.length >= CONCURRENCY) {
      await Promise.all(results);
      results.length = 0;
    }
  }
  if (results.length > 0) {
    await Promise.all(results);
  }
}

/**
 * Store a generated embedding for an image.
 * Calls Tauri command `generate_embedding`.
 */
export async function storeEmbedding(
  imageId: string,
  embedding: number[],
): Promise<void> {
  await invoke('generate_embedding', { imageId, embedding });
}

/**
 * Get aggregate embedding stats.
 * Calls Tauri command `get_embedding_stats_cmd`.
 */
export async function getEmbeddingStats(): Promise<EmbeddingStats> {
  const result = await invoke<EmbeddingStats>('get_embedding_stats_cmd');
  return {
    embedded: result.embedded ?? 0,
    pending: result.pending ?? 0,
    error: result.error ?? 0,
    total: result.total ?? 0,
  };
}
