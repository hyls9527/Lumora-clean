import { invoke } from '../tauri';

/**
 * Auto-detect ComfyUI output directory.
 *
 * Search order:
 * 1. Custom path from settings (if provided)
 * 2. ~/ComfyUI/output/
 * 3. ~/Desktop/ComfyUI/output/
 * 4. ComfyUI installation marker (main.py)
 */
export async function detectComfyuiPath(
  customPath?: string,
): Promise<string | null> {
  return invoke<string | null>('detect_comfyui_path', {
    customPath: customPath || null,
  });
}
