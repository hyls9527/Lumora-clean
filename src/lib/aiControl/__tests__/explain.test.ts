import { describe, it, expect } from 'vitest';
import { formatScoreExplanation } from '../explain';

describe('formatScoreExplanation', () => {
  const base = {
    fileName: 'cat.png',
    scoreLabel: '夯',
    aestheticScore: 8.7,
    hpsScore: 0.81,
    styleTotal: 120,
    percentile: 88,
  };

  it('shows HPS only when the backend marks it same-prompt comparable', () => {
    const comparable = formatScoreExplanation({ ...base, hpsComparable: true });
    expect(comparable).toContain('组内 HPS 0.8');
    expect(comparable).toContain('仅同 prompt 变体内可比');

    const lone = formatScoreExplanation({ ...base, hpsComparable: false });
    expect(lone).not.toContain('HPS');
  });

  it('omits HPS when the image has no HPS score', () => {
    const text = formatScoreExplanation({ ...base, hpsScore: undefined });
    expect(text).not.toContain('HPS');
  });

  it('keeps the within-style percentile regardless of HPS', () => {
    const text = formatScoreExplanation({ ...base, hpsComparable: false });
    expect(text).toContain('超过 88%');
    expect(text).toContain('同类 120 张');
  });
});
