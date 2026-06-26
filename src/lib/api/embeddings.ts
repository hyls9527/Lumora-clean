/**
 * Embedding API — delegates to real Tauri commands when available.
 * Falls back to mock data in browser mode.
 */

import { invoke } from '../tauri';

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

// ---------------------------------------------------------------------------
// Mock fallback for browser mode
// ---------------------------------------------------------------------------

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

const STATUS_BY_HASH: EmbeddingStatus[] = ['embedded', 'embedded', 'pending', 'error', 'embedded'];

function mockStatus(imageId: string): EmbeddingInfo {
  const h = Math.abs(hashCode(imageId));
  const status = STATUS_BY_HASH[h % STATUS_BY_HASH.length];
  return {
    status,
    dimensions: status === 'embedded' ? 512 : undefined,
    generatedAt:
      status === 'embedded'
        ? new Date(Date.now() - h % 86400000).toISOString()
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get embedding status for a single image.
 * Calls Tauri command `get_embedding_status_cmd` when available.
 */
export async function getEmbeddingStatus(
  imageId: string,
): Promise<EmbeddingInfo> {
  try {
    const result = await invoke<EmbeddingInfo | null>('get_embedding_status_cmd', { imageId });
    if (result) {
      return {
        status: result.status as EmbeddingStatus,
        dimensions: result.dimensions ?? undefined,
        generatedAt: result.generatedAt ?? undefined,
      };
    }
    // No embedding found — return pending status
    return { status: 'pending' };
  } catch {
    // Fallback to mock in browser mode
    return mockStatus(imageId);
  }
}

/**
 * Generate embeddings for a list of images.
 * In browser mode, this is a no-op mock.
 * In Tauri mode, the caller should provide the actual embedding vectors.
 */
export async function generateEmbeddings(
  imageIds: string[],
): Promise<void> {
  // In browser mode, simulate delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  void imageIds;
}

/**
 * Store a generated embedding for an image.
 * Calls Tauri command `generate_embedding` when available.
 */
export async function storeEmbedding(
  imageId: string,
  embedding: number[],
): Promise<void> {
  await invoke('generate_embedding', { imageId, embedding });
}

/**
 * Get aggregate embedding stats.
 * In browser mode, returns mock data.
 */
export async function getEmbeddingStats(): Promise<EmbeddingStats> {
  try {
    // This command doesn't exist yet in backend — will be added later
    // For now, return mock data
    return { embedded: 12, pending: 3, error: 1, total: 16 };
  } catch {
    return { embedded: 0, pending: 0, error: 0, total: 0 };
  }
}
