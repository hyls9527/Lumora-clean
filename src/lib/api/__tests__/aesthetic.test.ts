import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBestInLatestVariantGroup,
  getBestScoredRecent,
  getRecentScoreExplanation,
  getScoreExplanation,
  getScoreCurationSummary,
  moveScoreTierToTrash,
  scoreBackfill,
  scoreMissing,
} from '../aesthetic';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
  isTauriAvailable: false,
}));

// scoreBackfill starts a backend job; the loop it used to run is covered by the
// Rust tests in src-tauri/src/commands/job_commands.rs.
vi.mock('../jobs', () => ({
  startScoreMissingJob: vi.fn(),
}));

import { invoke } from '../../tauri';
import { startScoreMissingJob } from '../jobs';

describe('aesthetic API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends limit and maps the missing result', async () => {
    vi.mocked(invoke).mockResolvedValue({ processed: 3, remaining: 7 });
    const result = await scoreMissing(3);
    expect(invoke).toHaveBeenCalledWith('score_missing_cmd', { limit: 3 });
    expect(result).toEqual({ processed: 3, remaining: 7 });
  });

  it('defaults limit to 5 and guards missing fields', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const result = await scoreMissing();
    expect(invoke).toHaveBeenCalledWith('score_missing_cmd', { limit: 5 });
    expect(result).toEqual({ processed: 0, remaining: 0 });
  });

  it('moves a score tier to trash', async () => {
    vi.mocked(invoke).mockResolvedValue(3);
    const count = await moveScoreTierToTrash('拉');
    expect(invoke).toHaveBeenCalledWith('move_score_tier_to_trash', {
      tier: '拉',
    });
    expect(count).toBe(3);
  });

  it('fetches the best scored recent image', async () => {
    vi.mocked(invoke).mockResolvedValue({
      id: 'x',
      fileName: 'a.png',
      hpsScore: 27.5,
      aestheticScore: 8.7,
      scoreLabel: '夯',
    });
    const best = await getBestScoredRecent();
    expect(invoke).toHaveBeenCalledWith('get_best_scored_recent', { batch: 20 });
    expect(best?.fileName).toBe('a.png');
    expect(best?.aestheticScore).toBe(8.7);
    expect(best?.scoreLabel).toBe('夯');
  });

  it('returns null when no scored image exists', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    expect(await getBestScoredRecent()).toBeNull();
  });

  it('starts the backfill job and reports its id', async () => {
    vi.mocked(startScoreMissingJob).mockResolvedValue({
      id: 12,
      kind: 'score_missing',
      isNew: true,
    });

    const result = await scoreBackfill();

    expect(startScoreMissingJob).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ jobId: 12, isNew: true });
  });

  it('reports when an identical backfill was already running', async () => {
    vi.mocked(startScoreMissingJob).mockResolvedValue({
      id: 3,
      kind: 'score_missing',
      isNew: false,
    });

    // Joining a running job is not an error, but the caller must be able to tell
    // the user their click did not start a second run.
    await expect(scoreBackfill()).resolves.toEqual({ jobId: 3, isNew: false });
  });

  it('fetches the curation summary', async () => {
    vi.mocked(invoke).mockResolvedValue({
      hang: 3,
      wen: 5,
      la: 2,
      unscored: 1,
      recentLa: ['a.png', 'b.png'],
    });
    const summary = await getScoreCurationSummary();
    expect(invoke).toHaveBeenCalledWith('get_score_curation_summary');
    expect(summary).toEqual({
      hang: 3,
      wen: 5,
      la: 2,
      unscored: 1,
      recentLa: ['a.png', 'b.png'],
    });
  });

  it('fetches the best image in the latest variant group', async () => {
    vi.mocked(invoke).mockResolvedValue({
      id: 'v2',
      fileName: 'v2.png',
      hpsScore: 28.2,
      aestheticScore: 8.0,
      scoreLabel: '夯',
      groupSize: 2,
    });
    const best = await getBestInLatestVariantGroup();
    expect(invoke).toHaveBeenCalledWith('get_best_in_latest_variant_group');
    expect(best?.fileName).toBe('v2.png');
    expect(best?.hpsScore).toBe(28.2);
    expect(best?.groupSize).toBe(2);
  });

  it('returns null when no variant group exists', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    expect(await getBestInLatestVariantGroup()).toBeNull();
  });

  it('fetches a score explanation with percentile', async () => {
    vi.mocked(invoke).mockResolvedValue({
      fileName: 'b.png',
      hpsScore: 26.1,
      hpsStyle: 'Photo',
      aestheticScore: 6.2,
      scoreLabel: '稳',
      percentile: 50,
      styleTotal: 2,
    });
    const exp = await getScoreExplanation('b.png');
    expect(invoke).toHaveBeenCalledWith('get_score_explanation', {
      fileName: 'b.png',
    });
    expect(exp?.fileName).toBe('b.png');
    expect(exp?.percentile).toBe(50);
    expect(exp?.styleTotal).toBe(2);
  });

  it('returns null when the image is not in the library', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    expect(await getScoreExplanation('ghost.png')).toBeNull();
  });

  it('fetches the recent score explanation', async () => {
    vi.mocked(invoke).mockResolvedValue({
      fileName: 'new.png',
      hpsStyle: 'Animation',
      aestheticScore: 8.0,
      scoreLabel: '夯',
      percentile: 100,
      styleTotal: 1,
    });
    const exp = await getRecentScoreExplanation();
    expect(invoke).toHaveBeenCalledWith('get_recent_score_explanation');
    expect(exp?.fileName).toBe('new.png');
    expect(exp?.percentile).toBe(100);
  });

  it('returns null for recent explanation when nothing is scored', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    expect(await getRecentScoreExplanation()).toBeNull();
  });
});
