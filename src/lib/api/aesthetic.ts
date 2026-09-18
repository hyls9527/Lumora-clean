/**
 * Aesthetic judgment API - delegates to the Rust judgment layer.
 * The tier (夯 / 稳 / 拉) is an AI-internal decision, not a UI rating.
 */

import { invoke } from '../tauri';
import { startScoreMissingJob } from './jobs';

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
  /** Id of the job now doing the work. */
  jobId: number;
  /** False when an identical backfill was already running. */
  isNew: boolean;
}

/**
 * Start the aesthetic-scoring backfill as a backend job.
 *
 * This used to loop here, which meant the user could not stop it and lost the
 * rest of the work by navigating away. The loop — including the stalled-engine
 * guard — now lives in `src-tauri/src/commands/job_commands.rs`, so progress is
 * observable and Cancel works.
 */
export async function scoreBackfill(): Promise<ScoreBackfillResult> {
  const started = await startScoreMissingJob();
  return { jobId: started.id, isNew: started.isNew };
}

export interface ScoreCurationSummary {
  hang: number;
  wen: number;
  la: number;
  unscored: number;
  recentLa: string[];
}

/**
 * Aggregate the library by judgment tier plus recent "拉" images.
 * Calls Tauri command `get_score_curation_summary`.
 */
export async function getScoreCurationSummary(): Promise<ScoreCurationSummary> {
  const result = await invoke<ScoreCurationSummary>(
    'get_score_curation_summary',
  );
  return {
    hang: result?.hang ?? 0,
    wen: result?.wen ?? 0,
    la: result?.la ?? 0,
    unscored: result?.unscored ?? 0,
    recentLa: result?.recentLa ?? [],
  };
}

export interface BestVariantImage {
  id: string;
  fileName: string;
  hpsScore?: number;
  aestheticScore?: number;
  scoreLabel?: string;
  groupSize: number;
}

/**
 * Pick the best image of the most recently imported variant group (same
 * prompt), ranked by HPS v2 then aesthetic.
 * Calls Tauri command `get_best_in_latest_variant_group`.
 */
export async function getBestInLatestVariantGroup(): Promise<BestVariantImage | null> {
  const result = await invoke<BestVariantImage | null>(
    'get_best_in_latest_variant_group',
  );
  if (!result) return null;
  return {
    id: result.id,
    fileName: result.fileName,
    hpsScore: result.hpsScore ?? undefined,
    aestheticScore: result.aestheticScore ?? undefined,
    scoreLabel: result.scoreLabel ?? undefined,
    groupSize: result.groupSize ?? 0,
  };
}

export interface ScoreExplanation {
  fileName: string;
  hpsScore?: number;
  hpsComparable?: boolean;
  hpsStyle?: string;
  aestheticScore?: number;
  scoreLabel?: string;
  percentile?: number;
  styleTotal: number;
}

/**
 * Explain why a specific image is 夯 / 稳 / 拉 (style + within-style
 * percentile). Calls Tauri command `get_score_explanation`.
 */
export async function getScoreExplanation(
  fileName: string,
): Promise<ScoreExplanation | null> {
  const result = await invoke<ScoreExplanation | null>(
    'get_score_explanation',
    { fileName },
  );
  return mapExplanation(result);
}

/**
 * Explain the most recently imported scored image.
 * Calls Tauri command `get_recent_score_explanation`.
 */
export async function getRecentScoreExplanation(): Promise<ScoreExplanation | null> {
  const result = await invoke<ScoreExplanation | null>(
    'get_recent_score_explanation',
  );
  return mapExplanation(result);
}

function mapExplanation(result: ScoreExplanation | null): ScoreExplanation | null {
  if (!result) return null;
  return {
    fileName: result.fileName,
    hpsScore: result.hpsScore ?? undefined,
    hpsComparable: result.hpsComparable ?? false,
    hpsStyle: result.hpsStyle ?? undefined,
    aestheticScore: result.aestheticScore ?? undefined,
    scoreLabel: result.scoreLabel ?? undefined,
    percentile: result.percentile ?? undefined,
    styleTotal: result.styleTotal ?? 0,
  };
}
