import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBestInLatestVariantGroup,
  getBestScoredRecent,
  getScoreCurationSummary,
  moveScoreTierToTrash,
  scoreBackfill,
  scoreMissing,
} from '../aesthetic';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
  isTauriAvailable: false,
}));

import { invoke } from '../../tauri';

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

  it('backfills until nothing is left', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ processed: 50, remaining: 30 })
      .mockResolvedValueOnce({ processed: 30, remaining: 0 });
    const result = await scoreBackfill(50);
    expect(result).toEqual({ processed: 80, remaining: 0 });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('stops when the scoring engine is unavailable', async () => {
    vi.mocked(invoke).mockResolvedValue({ processed: 0, remaining: 100 });
    const result = await scoreBackfill(50);
    expect(result).toEqual({ processed: 0, remaining: 100 });
    expect(invoke).toHaveBeenCalledTimes(1);
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
});
