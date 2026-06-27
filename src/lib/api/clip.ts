/**
 * CLIP Embedding API — delegates to Python sidecar via Tauri commands.
 * Falls back to Ollama embedding in browser mode.
 */

import { invoke } from '../tauri';

/**
 * Generate image embedding using CLIP sidecar.
 * Calls Tauri command `clip_embed_image_cmd` when available.
 */
export async function clipEmbedImage(imagePath: string): Promise<number[]> {
  try {
    return await invoke<number[]>('clip_embed_image_cmd', { imagePath });
  } catch (error) {
    console.warn('[CLIP] Image embedding failed, falling back to Ollama:', error);
    // Fallback: use Ollama text embedding with image description
    return invoke<number[]>('embed_text_cmd', { text: `image: ${imagePath}` });
  }
}

/**
 * Generate text embedding using CLIP sidecar.
 * Calls Tauri command `clip_embed_text_cmd` when available.
 */
export async function clipEmbedText(text: string): Promise<number[]> {
  try {
    return await invoke<number[]>('clip_embed_text_cmd', { text });
  } catch (error) {
    console.warn('[CLIP] Text embedding failed, falling back to Ollama:', error);
    // Fallback: use Ollama embedding
    return invoke<number[]>('embed_text_cmd', { text });
  }
}
