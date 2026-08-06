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

export interface BestScoredImage {
  id: string;
  fileName: string;
  hpsScore?: number;
  aestheticScore?: number;
  scoreLabel?: string;
}

/**
 * Pick the best-scored image from the most recent imports.
 * Calls Tauri command `get_best_scored_recent`.
 */
export async function getBestScoredRecent(
  batch = 20,
): Promise<BestScoredImage | null> {
  const result = await invoke<BestScoredImage | null>('get_best_scored_recent', {
    batch,
  });
  if (!result) return null;
  return {
    id: result.id,
    fileName: result.fileName,
    hpsScore: result.hpsScore ?? undefined,
    aestheticScore: result.aestheticScore ?? undefined,
    scoreLabel: result.scoreLabel ?? undefined,
  };
}

export interface ScoreBackfillResult {
  processed: number;
  remaining: number;
}

/**
 * Backfill judgments for every unscored image, in batches.
 * Stops when nothing is left or when the engine is unavailable (processed 0
 * while remaining > 0 would otherwise spin forever).
 */
export async function scoreBackfill(
  limit = 50,
): Promise<ScoreBackfillResult> {
  let processed = 0;
  let remaining = 0;
  for (;;) {
    const result = await scoreMissing(limit);
    processed += result.processed;
    remaining = result.remaining;
    if (remaining === 0 || result.processed === 0) break;
  }
  return { processed, remaining };
}
