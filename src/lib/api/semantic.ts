/**
 * Semantic search API — delegates to real Tauri commands.
 */

import { invoke } from '../tauri';

export interface SemanticSearchResult {
  id: string;
  similarity: number;
}

/**
 * Perform a semantic search using Ollama embeddings + sqlite-vec.
 * Calls Tauri commands `embed_text_cmd` + `search_semantic_cmd`.
 */
export async function searchSemantic(
  query: string,
  limit?: number,
): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return [];

  // Step 1: Get query embedding from Ollama
  const embedding = await invoke<number[]>('embed_text_cmd', { text: query });

  // Step 2: Search similar images via sqlite-vec
  const results = await invoke<SemanticSearchResult[]>('search_semantic_cmd', {
    queryEmbedding: embedding,
    limit: limit ?? 20,
  });

  return results.map(r => ({
    id: r.id,
    similarity: Math.round(r.similarity * 100), // Convert 0-1 to 0-100
  }));
}

/**
 * Generate embedding for an image description.
 * Calls Tauri command `generate_embedding_for_image_cmd`.
 */
export async function generateImageEmbedding(
  imageId: string,
  description: string,
): Promise<void> {
  await invoke('generate_embedding_for_image_cmd', { imageId, description });
}

/** Perform an image-to-image semantic search via CLIP embedding. */
export async function searchByImage(
  filePath: string,
  limit?: number,
  excludeId?: string,
): Promise<SemanticSearchResult[]> {
  // Step 1: Get image embedding via CLIP
  const embedding = await invoke<number[]>('clip_embed_image_cmd', {
    imagePath: filePath,
  });

  // Step 2: Search similar images via sqlite-vec
  const results = await invoke<SemanticSearchResult[]>('search_semantic_cmd', {
    queryEmbedding: embedding,
    limit: limit ?? 20,
  });

  return results
    .filter((r) => r.id !== excludeId)
    .map((r) => ({
      id: r.id,
      similarity: Math.round(r.similarity * 100),
    }));
}

/**
 * Get search suggestions based on partial query input.
 * Returns empty array — suggestions are now generated client-side.
 */
export async function getSearchSuggestions(
  _query: string,
): Promise<string[]> {
  return [];
}
