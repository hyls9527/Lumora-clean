/**
 * Capability registry — the AI-native surface of every Lumora feature.
 * Add a new entry here (with a test in parser.test.ts) whenever a feature
 * becomes AI-controllable.
 */

import type { Capability } from './types';
import type { RoutePath } from '../../routes';
import { useSemanticSearchStore } from '../../stores/semanticSearchStore';
import { useTrashStore } from '../../stores/trashStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import {
  createSmartCollection,
  listSmartCollections,
  type SmartCollectionRule,
} from '../api/smartCollections';
import {
  getBestScoredRecent,
  getBestInLatestVariantGroup,
  getScoreCurationSummary,
  moveScoreTierToTrash,
  scoreBackfill,
} from '../api/aesthetic';

const PAGE_PATHS: Record<string, RoutePath> = {
  图库: '/gallery',
  收藏: '/favorites',
  智能相册: '/collections',
  智能收藏: '/collections',
  语义搜索: '/search',
  搜索: '/search',
  标签: '/tags',
  导出: '/export',
  设置: '/settings',
  回收站: '/trash',
  垃圾桶: '/trash',
  仪表盘: '/dashboard',
  导入: '/import',
};

function parseRules(text: string): SmartCollectionRule[] {
  const rules: SmartCollectionRule[] = [];
  const parts = text
    .split(/[、,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const tier = part.match(/^(夯|稳|拉|拉了)$/);
    if (tier) {
      rules.push({
        field: 'score',
        op: 'equals',
        value: tier[1] === '拉了' ? '拉' : tier[1],
      });
      continue;
    }
    let m =
      part.match(/评分\s*(\d+)\s*(?:以上|不低于)/) ??
      part.match(/评分\s*(?:>=|≥|大于等于)\s*(\d+)/);
    if (m) {
      rules.push({ field: 'rating', op: 'gte', value: m[1] });
      continue;
    }
    m =
      part.match(/评分\s*(\d+)\s*(?:以下|不高于)/) ??
      part.match(/评分\s*(?:<=|≤|小于等于)\s*(\d+)/);
    if (m) {
      rules.push({ field: 'rating', op: 'lte', value: m[1] });
      continue;
    }
    m = part.match(/模型\s*(?:等于|是|为)?\s*(.+)/);
    if (m) {
      rules.push({ field: 'model', op: 'equals', value: m[1] });
      continue;
    }
    m = part.match(/格式\s*(?:等于|是|为)?\s*(.+)/);
    if (m) {
      rules.push({ field: 'format', op: 'equals', value: m[1].toLowerCase() });
    }
  }
  return rules;
}

function rulesSummary(rules: SmartCollectionRule[]): string {
  if (rules.length === 0) return '未识别到规则';
  return rules
    .map((r) => {
      const op = r.op === 'gte' ? '≥' : r.op === 'lte' ? '≤' : r.op === 'equals' ? '=' : r.op;
      return `${r.field}${op}${r.value}`;
    })
    .join('，');
}

export const capabilities: Capability[] = [
  {
    id: 'navigate',
    name: '打开页面',
    pattern: {
      regex:
        /^(?:打开|去|前往|进入|跳转到?|显示|看(?:一下)?)\s*(图库|收藏|智能相册|智能收藏|语义搜索|搜索页?|标签|导出|设置|回收站|垃圾桶|仪表盘|导入)/,
      extract: (m) => ({ page: m[1] }),
      preview: (p) => `打开「${String(p.page)}」`,
    },
    execute: async (params, deps) => {
      const page = String(params.page);
      deps.navigate(PAGE_PATHS[page] ?? '/gallery');
      return `已打开${page}`;
    },
  },
  {
    id: 'createCollection',
    name: '创建智能相册',
    pattern: {
      regex:
        /^(?:建|创建|新建)(?:一个)?(?:智能)?(?:相册|收藏)(?:叫|名为|名字(?:是|为))?\s*(.+?)[：:，,]\s*(.+)$/,
      extract: (m) => {
        const name = m[1].trim();
        return { name, rules: parseRules(m[2]) };
      },
      preview: (p) =>
        `创建智能相册「${String(p.name)}」，规则：${rulesSummary(p.rules as SmartCollectionRule[])}`,
    },
    execute: async (params) => {
      const name = String(params.name);
      const rules = params.rules as SmartCollectionRule[];
      if (rules.length === 0) {
        throw new Error('没有识别到有效规则，试试：「建相册 高分：评分≥4」');
      }
      await createSmartCollection(name, rules);
      return `已创建智能相册「${name}」`;
    },
  },
  {
    id: 'scoreCuration',
    name: '按审美档筛图',
    pattern: {
      regex:
        /^(?:哪些|把|看(?:看)?|找(?:出|出来)?)\s*(?:图|作品)?(?:是)?\s*(夯|稳|拉|拉了)(?:的)?(?:图|作品)?(?:找出来|拿出来)?$/,
      extract: (m) => ({ tier: m[1] === '拉了' ? '拉' : m[1] }),
      preview: (p) => `筛出「${String(p.tier)}」的图`,
    },
    execute: async (params, deps) => {
      const tier = String(params.tier);
      const rules: SmartCollectionRule[] = [
        { field: 'score', op: 'equals', value: tier },
      ];
      const name = `${tier}的`;
      const existing = await listSmartCollections();
      const found = existing.find(
        (c) =>
          c.name === name &&
          c.rules.length === 1 &&
          c.rules[0].field === 'score' &&
          c.rules[0].op === 'equals' &&
          c.rules[0].value === tier,
      );
      if (!found) {
        await createSmartCollection(name, rules);
      }
      deps.navigate('/collections');
      return `已筛出「${tier}」的图`;
    },
  },
  {
    id: 'moveScoreTierToTrash',
    name: '把某档图移到回收站',
    pattern: {
      regex:
        /^(?:把|将)\s*(夯|稳|拉|拉了)(?:的)?(?:图|作品)?(?:都)?(?:移|丢|送)(?:到|进)?(?:回收站|垃圾桶)$/,
      extract: (m) => ({ tier: m[1] === '拉了' ? '拉' : m[1] }),
      preview: (p) => `把「${String(p.tier)}」的图移到回收站`,
    },
    execute: async (params, deps) => {
      const tier = String(params.tier);
      const count = await moveScoreTierToTrash(tier);
      deps.navigate('/trash');
      return `已把 ${count} 张「${tier}」的图移到回收站`;
    },
  },
  {
    id: 'bestScoredRecent',
    name: '看这批最夯的',
    pattern: {
      regex:
        /^(?:这批|刚才这批|最近这批)?(?:里|中)?(?:最夯|最能打|评分最高|最好|最强)(?:的)?(?:是)?(?:哪张|哪一张|那张)?(?:图|作品)?$/,
      extract: () => ({}),
      preview: () => '找出最近这批最夯的图',
    },
    execute: async () => {
      const best = await getBestScoredRecent(20);
      if (!best) {
        return '最近这批还没出评分，AI 正在后台评审';
      }
      const aesthetic =
        best.aestheticScore != null ? `，美学 ${best.aestheticScore.toFixed(1)}` : '';
      const hps = best.hpsScore != null ? `，HPS ${best.hpsScore.toFixed(1)}` : '';
      return `最夯的是「${best.fileName}」${aesthetic}${hps}（${best.scoreLabel ?? '未评分'}）`;
    },
  },
  {
    id: 'scoreBackfill',
    name: '补齐全库评分',
    pattern: {
      regex:
        /^(?:(?:把|给|将)?\s*(?:全库|全图库|所有图(?:片)?|全部图(?:片)?)?\s*(?:的)?\s*评分\s*(?:补上|补齐|补完)?|补\s*(?:上|齐|完)?\s*评分|(?:把|给|将)?\s*(?:全库|全图库|所有图(?:片)?|全部图(?:片)?)?\s*都?\s*评(?:一遍|一下))$/,
      extract: () => ({}),
      preview: () => '为全库补齐评分',
    },
    execute: async () => {
      const task = scoreBackfill(50).then((result) => {
        if (result.processed > 0) {
          useToastStore
            .getState()
            .addToast('success', `已为 ${result.processed} 张图补齐评分`);
        } else if (result.remaining > 0) {
          useToastStore
            .getState()
            .addToast('warning', '评分引擎不可用，保持未评分');
        }
      });
      task.catch(() => {
        useToastStore.getState().addToast('error', '评分补齐失败');
      });
      return '正在后台为全库补齐评分';
    },
  },
  {
    id: 'curationSummary',
    name: '回收建议',
    pattern: {
      regex:
        /^(?:回收建议|库里(?:现在|目前)?(?:有|还有)?多少(?:张)?(?:拉|拉的)|现在有哪些拉的|拉(?:的)?有(?:多少|几)张)$/,
      extract: () => ({}),
      preview: () => '汇总库里「拉」的图',
    },
    execute: async () => {
      const summary = await getScoreCurationSummary();
      const judged = summary.hang + summary.wen + summary.la;
      const laPercent =
        judged > 0 ? Math.round((summary.la / judged) * 100) : 0;
      let message = `库里有 ${summary.la} 张「拉」`;
      if (judged > 0) {
        message += `（占已评审 ${laPercent}%）`;
      }
      if (summary.unscored > 0) {
        message += `，还有 ${summary.unscored} 张未评审`;
      }
      if (summary.recentLa.length > 0) {
        message += `；最近：${summary.recentLa.join('、')}`;
      }
      message += '。要我移进回收站吗？';
      return message;
    },
  },
  {
    id: 'bestInVariantGroup',
    name: '同 prompt 最夯',
    pattern: {
      regex:
        /^(?:(?:同 ?prompt|同 ?一个 ?prompt|同一 ?prompt|同款|这批变体|这个变体组|同一批)\s*(?:里|中)?\s*(?:最夯|最能打|评分最高|最好|最强)(?:的)?(?:是)?(?:哪张|哪一张|那张)?|(?:同 ?prompt|同 ?一个 ?prompt|同一 ?prompt|这批变体|这个变体组)\s*(?:里|中)?\s*(?:哪张|哪一张)(?:图|作品)?(?:最夯|最能打|评分最高|最好|最强))(?:图|作品)?$/,
      extract: () => ({}),
      preview: () => '找同 prompt 变体里最夯的图',
    },
    execute: async () => {
      const best = await getBestInLatestVariantGroup();
      if (!best) {
        return '还没有可比较的变体组（需要同一 prompt 的多张图）';
      }
      const hps =
        best.hpsScore != null ? `，HPS ${best.hpsScore.toFixed(1)}` : '';
      const aesthetic =
        best.aestheticScore != null
          ? `，美学 ${best.aestheticScore.toFixed(1)}`
          : '';
      return `「${best.fileName}」是同 prompt 变体里最夯的${hps}${aesthetic}（组内共 ${best.groupSize} 张）`;
    },
  },
  {
    id: 'semanticSearch',
    name: '语义搜索',
    pattern: {
      regex:
        /^(?:找|搜(?:索|一下|一找)?|查找|看看?有没有)\s*(.+?)(?:的图(?:片|像)?|图片|图|画面|作品)?$/,
      extract: (m) => ({ query: m[1].trim() }),
      preview: (p) => `语义搜索「${String(p.query)}」`,
    },
    execute: async (params, deps) => {
      const query = String(params.query);
      deps.navigate('/search');
      await useSemanticSearchStore.getState().search(query);
      return `正在搜索「${query}」`;
    },
  },
  {
    id: 'emptyTrash',
    name: '清空回收站',
    pattern: {
      regex: /^(?:清空|清一下|清掉|清光)\s*(回收站|垃圾桶)/,
      extract: () => ({}),
      preview: () => '清空回收站',
    },
    execute: async (_params, deps) => {
      const count = await useTrashStore.getState().emptyTrash();
      deps.navigate('/trash');
      return `已清空回收站（${count} 张）`;
    },
  },
  {
    id: 'setTheme',
    name: '切换主题',
    pattern: {
      regex:
        /^(?:切换?(?:到)?|换成|使用|开启|打开|启用|关掉|关闭)?\s*(暗色|深色|夜间|亮色|浅色|日间|白天)\s*(?:主题|模式)?$/,
      extract: (m) => ({
        theme: ['暗色', '深色', '夜间'].includes(m[1]) ? 'dark' : 'light',
      }),
      preview: (p) => `切换到${p.theme === 'dark' ? '暗色' : '亮色'}主题`,
    },
    execute: async (params) => {
      const theme = params.theme === 'dark' ? 'dark' : 'light';
      await useSettingsStore.getState().setTheme(theme);
      return `已切换到${theme === 'dark' ? '暗色' : '亮色'}主题`;
    },
  },
];
