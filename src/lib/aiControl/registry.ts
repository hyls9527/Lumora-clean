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
import {
  createSmartCollection,
  type SmartCollectionRule,
} from '../api/smartCollections';

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
