// ---------------------------------------------------------------------------
// AI Analysis API — delegates to real Tauri commands when available.
// Falls back to mock data in browser mode.
// ---------------------------------------------------------------------------

import { invoke } from '../tauri';

export interface AnalysisTag {
  name: string;
  confidence: number; // 0-1
}

export interface AnalysisResult {
  description: string;
  tags: AnalysisTag[];
  objects: string[];
  colorPalette: string[];
  composition: string;
}

export interface AnalysisHistoryItem {
  id: string;
  imageId: string;
  result: AnalysisResult;
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Snake_case → camelCase conversion helper
// ---------------------------------------------------------------------------

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamel);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        snakeToCamel(key),
        convertKeysToCamel(value),
      ]),
    );
  }
  return obj;
}

function normalizeAnalysisResult(raw: unknown): AnalysisResult {
  const converted = convertKeysToCamel(raw) as Record<string, unknown>;
  return {
    description: (converted.description as string) ?? '',
    tags: (converted.tags as AnalysisTag[]) ?? [],
    objects: (converted.objects as string[]) ?? [],
    colorPalette: (converted.colorPalette as string[]) ?? [],
    composition: (converted.composition as string) ?? '',
  };
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze an image using AI (Ollama vision model).
 * Calls Tauri command `analyze_image_cmd` when available.
 */
export async function analyzeImage(
  imageId: string,
  imagePath?: string,
  model?: string,
): Promise<AnalysisResult> {
  const result = await invoke<unknown>('analyze_image_cmd', {
    imageId,
    imagePath: imagePath ?? '',
    model: model ?? undefined,
  });
  return normalizeAnalysisResult(result);
}

/**
 * Get the most recent analysis result for an image.
 * Calls Tauri command `get_analysis_result_cmd` when available.
 */
export async function getAnalysisResult(imageId: string): Promise<AnalysisResult | null> {
  const result = await invoke<unknown>('get_analysis_result_cmd', { imageId });
  if (result) {
    return normalizeAnalysisResult(result);
  }
  return null;
}

/**
 * Get analysis history for an image.
 * Calls Tauri command `get_analysis_history_cmd` when available.
 */
export async function getAnalysisHistory(imageId: string): Promise<AnalysisHistoryItem[]> {
  const items = await invoke<unknown[]>('get_analysis_history_cmd', { imageId });
  return items.map(item => {
    const converted = convertKeysToCamel(item) as Record<string, unknown>;
    return {
      id: (converted.id as string) ?? '',
      imageId: (converted.imageId as string) ?? '',
      result: normalizeAnalysisResult(converted.result),
      analyzedAt: (converted.analyzedAt as string) ?? '',
    };
  });
}
