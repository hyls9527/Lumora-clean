import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moveScoreTierToTrash, scoreMissing } from '../aesthetic';

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
});
