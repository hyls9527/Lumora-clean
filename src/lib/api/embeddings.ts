/**
 * Embedding API stub layer.
 * Returns mock data in browser; delegates to real Tauri commands when available.
 */

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
// Mock data store — deterministic based on imageId hash
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

export async function getEmbeddingStatus(
  imageId: string,
): Promise<EmbeddingInfo> {
  return mockStatus(imageId);
}

export async function generateEmbeddings(
  imageIds: string[],
): Promise<void> {
  // Mock 2-second delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  void imageIds;
}

export async function getEmbeddingStats(): Promise<EmbeddingStats> {
  return { embedded: 12, pending: 3, error: 1, total: 16 };
}
