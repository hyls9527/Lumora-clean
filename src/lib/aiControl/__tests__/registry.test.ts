import { describe, it, expect, vi, beforeEach } from 'vitest';
import { capabilities } from '../registry';
import type { AiDeps, Capability } from '../types';

/**
 * The registry is the AI-native control surface: every capability must map a
 * natural-language sentence onto a real store/API call. These tests drive the
 * real patterns and the real execute() bodies with mocked side effects.
 */
const m = vi.hoisted(() => ({
  search: vi.fn(),
  emptyTrash: vi.fn(),
  setTheme: vi.fn(),
  addToast: vi.fn(),
  listSmartCollections: vi.fn(),
  createSmartCollection: vi.fn(),
  moveScoreTierToTrash: vi.fn(),
  getBestScoredRecent: vi.fn(),
  getBestInLatestVariantGroup: vi.fn(),
  getRecentScoreExplanation: vi.fn(),
  getScoreExplanation: vi.fn(),
  getScoreCurationSummary: vi.fn(),
  scoreBackfill: vi.fn(),
}));

vi.mock('../../api/smartCollections', () => ({
  listSmartCollections: m.listSmartCollections,
  createSmartCollection: m.createSmartCollection,
}));

vi.mock('../../api/aesthetic', () => ({
  getBestScoredRecent: m.getBestScoredRecent,
  getBestInLatestVariantGroup: m.getBestInLatestVariantGroup,
  getRecentScoreExplanation: m.getRecentScoreExplanation,
  getScoreExplanation: m.getScoreExplanation,
  getScoreCurationSummary: m.getScoreCurationSummary,
  moveScoreTierToTrash: m.moveScoreTierToTrash,
  scoreBackfill: m.scoreBackfill,
}));

vi.mock('../../../stores/semanticSearchStore', () => ({
  useSemanticSearchStore: { getState: () => ({ search: m.search }) },
}));

vi.mock('../../../stores/trashStore', () => ({
  useTrashStore: { getState: () => ({ emptyTrash: m.emptyTrash }) },
}));

vi.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ setTheme: m.setTheme }) },
}));

vi.mock('../../../stores/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: m.addToast }) },
}));

function capability(id: string): Capability {
  const found = capabilities.find((c) => c.id === id);
  if (!found) throw new Error('no capability registered: ' + id);
  return found;
}

/** Parse a sentence the way the real parser does, then return the params. */
function paramsFor(id: string, sentence: string): Record<string, unknown> {
  const cap = capability(id);
  const match = sentence.match(cap.pattern.regex);
  if (!match) throw new Error(`pattern for ${id} did not match "${sentence}"`);
  return cap.pattern.extract(match);
}

function deps(): AiDeps {
  return { navigate: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('navigate capability', () => {
  it('maps every registered page word onto its route', async () => {
    const cases: Array<[string, string]> = [
      ['打开图库', '/gallery'],
      ['去收藏', '/favorites'],
      ['前往智能相册', '/collections'],
      ['进入设置', '/settings'],
      ['显示回收站', '/trash'],
      ['打开仪表盘', '/dashboard'],
      ['去导出', '/export'],
      ['打开导入', '/import'],
    ];

    for (const [sentence, path] of cases) {
      const d = deps();
      const params = paramsFor('navigate', sentence);
      await expect(capability('navigate').execute(params, d)).resolves.toContain(
        String(params.page),
      );
      expect(d.navigate).toHaveBeenCalledWith(path);
    }
  });

  it('falls back to the gallery for an unknown page word', async () => {
    const d = deps();

    await capability('navigate').execute({ page: '不存在' }, d);

    expect(d.navigate).toHaveBeenCalledWith('/gallery');
  });

  it('previews the target page', () => {
    expect(capability('navigate').pattern.preview({ page: '回收站' })).toBe('打开「回收站」');
  });
});

describe('createCollection capability', () => {
  it('previews the parsed rules in human-readable order', () => {
    const params = paramsFor('createCollection', '建相册 SDXL精选：模型等于SDXL、评分4以上');

    expect(capability('createCollection').pattern.preview(params)).toBe(
      '创建智能相册「SDXL精选」，规则：model=SDXL，rating≥4',
    );
  });

  it('creates the collection through the API', async () => {
    m.createSmartCollection.mockResolvedValueOnce({ id: 'sc1' });
    const params = paramsFor('createCollection', '建相册 高分：评分≥4');

    const reply = await capability('createCollection').execute(params, deps());

    expect(reply).toBe('已创建智能相册「高分」');
    expect(m.createSmartCollection).toHaveBeenCalledWith('高分', [
      { field: 'rating', op: 'gte', value: '4' },
    ]);
  });

  it('refuses to create a collection without any recognizable rule', async () => {
    await expect(
      capability('createCollection').execute({ name: '空的', rules: [] }, deps()),
    ).rejects.toThrow('没有识别到有效规则');
    expect(m.createSmartCollection).not.toHaveBeenCalled();
  });

  it('summarizes an unrecognized rule list instead of an empty preview', () => {
    const params = paramsFor('createCollection', '建相册 空的：随便写点什么');

    expect(params.rules).toEqual([]);
    expect(capability('createCollection').pattern.preview(params)).toContain('未识别到规则');
  });
});

describe('scoreCuration capability', () => {
  it('reuses an existing 夯 collection instead of creating a duplicate', async () => {
    m.listSmartCollections.mockResolvedValueOnce([
      {
        id: 'sc1',
        name: '夯的',
        createdAt: '2025-01-01',
        count: 3,
        rules: [{ field: 'score', op: 'equals', value: '夯' }],
      },
    ]);
    const d = deps();

    const reply = await capability('scoreCuration').execute({ tier: '夯' }, d);

    expect(reply).toBe('已筛出「夯」的图');
    expect(m.createSmartCollection).not.toHaveBeenCalled();
    expect(d.navigate).toHaveBeenCalledWith('/collections');
  });

  it('creates the collection when the tier has none yet', async () => {
    m.listSmartCollections.mockResolvedValueOnce([]);
    m.createSmartCollection.mockResolvedValueOnce({ id: 'sc2' });

    await capability('scoreCuration').execute({ tier: '拉' }, deps());

    expect(m.createSmartCollection).toHaveBeenCalledWith('拉的', [
      { field: 'score', op: 'equals', value: '拉' },
    ]);
  });

  it('normalizes the colloquial 拉了 to the 拉 tier', () => {
    expect(paramsFor('scoreCuration', '哪些是拉了')).toEqual({ tier: '拉' });
  });
});

describe('moveScoreTierToTrash capability', () => {
  it('moves the tier and reports the count', async () => {
    m.moveScoreTierToTrash.mockResolvedValueOnce(7);
    const d = deps();
    const params = paramsFor('moveScoreTierToTrash', '把拉的图都移到回收站');

    const reply = await capability('moveScoreTierToTrash').execute(params, d);

    expect(m.moveScoreTierToTrash).toHaveBeenCalledWith('拉');
    expect(d.navigate).toHaveBeenCalledWith('/trash');
    expect(reply).toBe('已把 7 张「拉」的图移到回收站');
  });
});

describe('bestScoredRecent capability', () => {
  it('reports the best image with its aesthetic score', async () => {
    m.getBestScoredRecent.mockResolvedValueOnce({
      id: 'img-1',
      fileName: 'best.png',
      aestheticScore: 7.25,
      scoreLabel: '夯',
    });

    const reply = await capability('bestScoredRecent').execute(
      paramsFor('bestScoredRecent', '最夯的是哪张'),
      deps(),
    );

    expect(m.getBestScoredRecent).toHaveBeenCalledWith(20);
    expect(reply).toBe('最夯的是「best.png」，美学 7.3（夯）');
  });

  it('omits the aesthetic part when the image has no aesthetic score', async () => {
    m.getBestScoredRecent.mockResolvedValueOnce({ id: 'img-2', fileName: 'raw.png' });

    const reply = await capability('bestScoredRecent').execute({}, deps());

    expect(reply).toBe('最夯的是「raw.png」（未评分）');
  });

  it('explains that nothing is scored yet', async () => {
    m.getBestScoredRecent.mockResolvedValueOnce(null);

    await expect(capability('bestScoredRecent').execute({}, deps())).resolves.toBe(
      '最近这批还没出评分，AI 正在后台评审',
    );
  });
});

// The backfill is a background job now, so this capability can only report what
// was started. Whether the work succeeds, stalls, or is cancelled is visible in
// the job bar instead of in a toast that used to fire minutes later.
describe('scoreBackfill capability', () => {
  it('starts the job and says so', async () => {
    m.scoreBackfill.mockResolvedValueOnce({ jobId: 5, isNew: true });

    const reply = await capability('scoreBackfill').execute({}, deps());

    expect(reply).toBe('正在后台为全库补齐评分');
    expect(m.scoreBackfill).toHaveBeenCalledTimes(1);
    expect(m.addToast).toHaveBeenCalledWith(
      'success',
      '正在后台为全库补齐评分，可在底部任务条取消',
    );
  });

  it('does not pretend a second run started when one is already going', async () => {
    m.scoreBackfill.mockResolvedValueOnce({ jobId: 5, isNew: false });

    const reply = await capability('scoreBackfill').execute({}, deps());

    expect(reply).toBe('已有一个评分补齐任务在进行中');
    // Reusing the running job is correct; announcing a fresh start is not.
    expect(m.addToast).not.toHaveBeenCalledWith(
      'success',
      '正在后台为全库补齐评分，可在底部任务条取消',
    );
  });

  it('propagates a failure to start', async () => {
    m.scoreBackfill.mockRejectedValueOnce(new Error('db locked'));

    // Failing loudly beats replying "running" for a job that never started.
    await expect(capability('scoreBackfill').execute({}, deps())).rejects.toThrow('db locked');
  });
});

describe('curationSummary capability', () => {
  it('summarizes the 拉 share, the unscored tail and recent examples', async () => {
    m.getScoreCurationSummary.mockResolvedValueOnce({
      hang: 5,
      wen: 3,
      la: 2,
      unscored: 4,
      recentLa: ['a.png', 'b.png'],
    });

    const reply = await capability('curationSummary').execute(
      paramsFor('curationSummary', '回收建议'),
      deps(),
    );

    expect(reply).toBe('库里有 2 张「拉」（占已评审 20%），还有 4 张未评审；最近：a.png、b.png。要我移进回收站吗？');
  });

  it('omits the percentage when nothing has been judged', async () => {
    m.getScoreCurationSummary.mockResolvedValueOnce({
      hang: 0,
      wen: 0,
      la: 0,
      unscored: 0,
      recentLa: [],
    });

    const reply = await capability('curationSummary').execute({}, deps());

    expect(reply).toBe('库里有 0 张「拉」。要我移进回收站吗？');
    expect(reply).not.toContain('占已评审');
  });
});

describe('bestInVariantGroup capability', () => {
  it('compares only inside the group and reports HPS plus aesthetic', async () => {
    m.getBestInLatestVariantGroup.mockResolvedValueOnce({
      id: 'img-9',
      fileName: 'v3.png',
      hpsScore: 0.81,
      aestheticScore: 6.44,
      groupSize: 4,
    });

    const reply = await capability('bestInVariantGroup').execute(
      paramsFor('bestInVariantGroup', '同prompt里最夯的是哪张'),
      deps(),
    );

    expect(reply).toBe('「v3.png」是同 prompt 变体里最夯的，HPS 0.8，美学 6.4（组内共 4 张）');
  });

  it('handles a group without HPS or aesthetic scores', async () => {
    m.getBestInLatestVariantGroup.mockResolvedValueOnce({
      id: 'img-9',
      fileName: 'v1.png',
      groupSize: 2,
    });

    const reply = await capability('bestInVariantGroup').execute({}, deps());

    expect(reply).toBe('「v1.png」是同 prompt 变体里最夯的（组内共 2 张）');
  });

  it('explains when there is no variant group to compare', async () => {
    m.getBestInLatestVariantGroup.mockResolvedValueOnce(null);

    await expect(capability('bestInVariantGroup').execute({}, deps())).resolves.toBe(
      '还没有可比较的变体组（需要同一 prompt 的多张图）',
    );
  });
});

describe('scoreExplanation capability', () => {
  it('looks a file up by name and formats its explanation', async () => {
    m.getScoreExplanation.mockResolvedValueOnce({
      fileName: 'fox.png',
      aestheticScore: 6.2,
      scoreLabel: '稳',
      styleTotal: 12,
    });

    const reply = await capability('scoreExplanation').execute(
      paramsFor('scoreExplanation', '为什么fox.png是稳'),
      deps(),
    );

    expect(m.getScoreExplanation).toHaveBeenCalledWith('fox.png');
    expect(reply).toContain('「fox.png」是「稳」：美学 6.2');
  });

  it('says a file was not found instead of guessing', async () => {
    m.getScoreExplanation.mockResolvedValueOnce(null);

    await expect(
      capability('scoreExplanation').execute({ name: 'ghost.png' }, deps()),
    ).resolves.toBe('库里没找到「ghost.png」');
  });

  it('falls back to the most recent scored image for a non-file reference', async () => {
    m.getRecentScoreExplanation.mockResolvedValueOnce(null);

    const reply = await capability('scoreExplanation').execute({ name: '这张' }, deps());

    expect(m.getRecentScoreExplanation).toHaveBeenCalled();
    expect(reply).toBe('还没有已评分的图，说「把评分补上」就行');
  });

  it('reports an unscored image rather than inventing a tier', async () => {
    m.getRecentScoreExplanation.mockResolvedValueOnce({ fileName: 'new.png', styleTotal: 0 });

    await expect(capability('scoreExplanation').execute({ name: '这张' }, deps())).resolves.toBe(
      '「new.png」还没评分，说「把评分补上」就行',
    );
  });
});

describe('semanticSearch capability', () => {
  it('navigates to search and runs the real store search', async () => {
    m.search.mockResolvedValueOnce(undefined);
    const d = deps();

    const reply = await capability('semanticSearch').execute(
      paramsFor('semanticSearch', '找月光的森林的图片'),
      d,
    );

    expect(d.navigate).toHaveBeenCalledWith('/search');
    expect(m.search).toHaveBeenCalledWith('月光的森林');
    expect(reply).toBe('正在搜索「月光的森林」');
  });
});

describe('emptyTrash capability', () => {
  it('empties the trash and lands on the trash page', async () => {
    m.emptyTrash.mockResolvedValueOnce(undefined);
    const d = deps();

    await capability('emptyTrash').execute({}, d);

    expect(m.emptyTrash).toHaveBeenCalled();
    expect(d.navigate).toHaveBeenCalledWith('/trash');
  });
});

describe('setTheme capability', () => {
  it('switches to dark for every dark synonym', async () => {
    for (const word of ['暗色', '深色', '夜间']) {
      m.setTheme.mockClear();
      await capability('setTheme').execute(paramsFor('setTheme', word + '主题'), deps());
      expect(m.setTheme).toHaveBeenCalledWith('dark');
    }
  });

  it('switches to light for every light synonym', async () => {
    for (const word of ['亮色', '浅色', '日间', '白天']) {
      m.setTheme.mockClear();
      await capability('setTheme').execute(paramsFor('setTheme', word), deps());
      expect(m.setTheme).toHaveBeenCalledWith('light');
    }
  });

  it('reports the applied theme', async () => {
    m.setTheme.mockResolvedValueOnce(undefined);

    await expect(capability('setTheme').execute({ theme: 'dark' }, deps())).resolves.toBe(
      '已切换到暗色主题',
    );
  });
});

describe('capability table integrity', () => {
  it('registers unique, anchored, self-consistent entries', () => {
    const ids = capabilities.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const cap of capabilities) {
      expect(cap.name).toBeTruthy();
      expect(cap.pattern.regex.source.startsWith('^')).toBe(true);
      // An unanchored pattern would swallow unrelated sentences.
      expect(cap.pattern.regex.test('')).toBe(false);
    }
  });
});
