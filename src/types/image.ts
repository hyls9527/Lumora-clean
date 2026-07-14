/**
 * ImageRecord — shared image metadata type.
 *
 * Extracted from stores/imageStore.ts to break the circular dependency
 * between imageStore ↔ lib/api/images and imageStore ↔ lib/api/embeddings.
 */

export interface ImageRecord {
  id: string;
  filePath: string;
  fileName: string;
  fileSizeKb: number;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp' | 'avif';
  createdAt: string;
  rating: number;        // 0-5
  favorite: boolean;
  model: string;
  prompt: string;
  tags: string[];
  similarity?: number;   // 0-100, used by search
  deleted?: boolean;
  deletedAt?: string;
  variantGroupId?: string | null;
}
