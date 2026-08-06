/**
 * Aesthetic judgment API - delegates to the Rust judgment layer.
 * The tier (夯 / 稳 / 拉) is an AI-internal decision, not a UI rating.
 */

import { invoke } from '../tauri';

export interface ScoreMissingResult {
  processed: number;
  remaining: number;
}

/**
 * Score a batch of images that have no judgment yet.
 * Calls Tauri command `score_missing_cmd`.
 */
export async function scoreMissing(
  limit = 5,
): Promise<ScoreMissingResult> {
  const result = await invoke<ScoreMissingResult>('score_missing_cmd', {
    limit,
  });
  return {
    processed: result?.processed ?? 0,
    remaining: result?.remaining ?? 0,
  };
}

/**
 * Move every non-deleted image of a judgment tier (夯 / 稳 / 拉) to trash.
 * Calls Tauri command `move_score_tier_to_trash`.
 */
export async function moveScoreTierToTrash(tier: string): Promise<number> {
  const result = await invoke<number>('move_score_tier_to_trash', { tier });
  return result ?? 0;
}
