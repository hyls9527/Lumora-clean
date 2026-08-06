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
