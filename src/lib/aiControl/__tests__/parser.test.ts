import { describe, it, expect } from 'vitest';
import { parseIntent } from '../parser';
import { capabilities } from '../registry';

describe('AI control intent parser', () => {
  it('parses navigation intents with common verbs', () => {
    for (const input of ['打开图库', '去收藏', '前往智能相册', '进入设置', '显示回收站']) {
      const intent = parseIntent(input, capabilities);
      expect(intent?.capabilityId).toBe('navigate');
    }
    expect(parseIntent('打开设置', capabilities)?.params).toEqual({ page: '设置' });
  });

  it('parses semantic search intents', () => {
    const intent = parseIntent('找月光的森林', capabilities);
    expect(intent?.capabilityId).toBe('semanticSearch');
    expect(intent?.params).toEqual({ query: '月光的森林' });

    const withSuffix = parseIntent('搜索一只红色的猫的图片', capabilities);
    expect(withSuffix?.capabilityId).toBe('semanticSearch');
    expect(withSuffix?.params).toEqual({ query: '一只红色的猫' });
  });

  it('parses smart collection creation with rating rules', () => {
    const intent = parseIntent('建相册 高分：评分≥4', capabilities);
    expect(intent?.capabilityId).toBe('createCollection');
    expect(intent?.params).toMatchObject({
      name: '高分',
      rules: [{ field: 'rating', op: 'gte', value: '4' }],
    });
  });

  it('parses smart collection creation with multiple rules', () => {
    const intent = parseIntent('创建相册 SDXL精选：模型等于SDXL、评分4以上', capabilities);
    expect(intent?.capabilityId).toBe('createCollection');
    expect(intent?.params).toMatchObject({
      name: 'SDXL精选',
      rules: [
        { field: 'model', op: 'equals', value: 'SDXL' },
        { field: 'rating', op: 'gte', value: '4' },
      ],
    });
  });

  it('parses smart collection creation with score tiers', () => {
    const intent = parseIntent('建相册 夯货：夯', capabilities);
    expect(intent?.capabilityId).toBe('createCollection');
    expect(intent?.params).toMatchObject({
      name: '夯货',
      rules: [{ field: 'score', op: 'equals', value: '夯' }],
    });

    const la = parseIntent('建相册 翻车：拉了', capabilities);
    expect(la?.params).toMatchObject({
      rules: [{ field: 'score', op: 'equals', value: '拉' }],
    });
  });

  it('parses score curation intents', () => {
    const cases: Array<[string, string]> = [
      ['哪些拉了', '拉'],
      ['哪些是夯的', '夯'],
      ['把稳的找出来', '稳'],
    ];
    for (const [input, tier] of cases) {
      const intent = parseIntent(input, capabilities);
      expect(intent?.capabilityId).toBe('scoreCuration');
      expect(intent?.params).toEqual({ tier });
    }
  });

  it('parses move-score-tier-to-trash intents', () => {
    const intent = parseIntent('把拉的移到回收站', capabilities);
    expect(intent?.capabilityId).toBe('moveScoreTierToTrash');
    expect(intent?.params).toEqual({ tier: '拉' });
    expect(parseIntent('把夯的丢垃圾桶', capabilities)?.params).toEqual({
      tier: '夯',
    });
  });

  it('parses best-scored-recent intents', () => {
    const intent = parseIntent('这批最夯的是哪张', capabilities);
    expect(intent?.capabilityId).toBe('bestScoredRecent');
    expect(parseIntent('评分最高的是哪张图', capabilities)?.capabilityId).toBe(
      'bestScoredRecent',
    );
  });

  it('parses score backfill intents', () => {
    for (const input of ['把评分补上', '给全库评分', '补评分', '把所有图都评一遍']) {
      const intent = parseIntent(input, capabilities);
      expect(intent?.capabilityId, input).toBe('scoreBackfill');
    }
  });

  it('parses curation summary intents', () => {
    for (const input of ['回收建议', '库里有多少拉的', '现在有哪些拉的']) {
      const intent = parseIntent(input, capabilities);
      expect(intent?.capabilityId, input).toBe('curationSummary');
    }
  });

  it('parses best-in-variant-group intents', () => {
    for (const input of [
      '同 prompt 最夯的是哪张',
      '这批变体里哪张最夯',
      '同一个 prompt 里评分最高的是哪张',
    ]) {
      const intent = parseIntent(input, capabilities);
      expect(intent?.capabilityId, input).toBe('bestInVariantGroup');
    }
  });

  it('parses score-explanation intents', () => {
    const intent = parseIntent('为什么 b.png 是拉的', capabilities);
    expect(intent?.capabilityId).toBe('scoreExplanation');
    expect(intent?.params).toEqual({ name: 'b.png', tier: '拉' });
    const second = parseIntent('为啥这张图被评成夯', capabilities);
    expect(second?.capabilityId).toBe('scoreExplanation');
    expect(second?.params).toEqual({ name: '这张图', tier: '夯' });
  });

  it('parses empty trash intents', () => {
    const intent = parseIntent('清空回收站', capabilities);
    expect(intent?.capabilityId).toBe('emptyTrash');
  });

  it('parses theme switching intents', () => {
    expect(parseIntent('切换暗色主题', capabilities)?.params).toEqual({ theme: 'dark' });
    expect(parseIntent('使用亮色模式', capabilities)?.params).toEqual({ theme: 'light' });
    expect(parseIntent('夜间', capabilities)?.params).toEqual({ theme: 'dark' });
  });

  it('returns null for unrecognized input', () => {
    expect(parseIntent('今天天气怎么样', capabilities)).toBeNull();
    expect(parseIntent('', capabilities)).toBeNull();
  });
});
