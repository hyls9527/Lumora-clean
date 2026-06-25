/**
 * Semantic search API stubs — returns mock data for frontend development.
 * Will be replaced with real Tauri invoke calls once the backend is ready.
 */

export interface SemanticSearchResult {
  id: string;
  similarity: number;
}

// Mock suggestion pool
const SUGGESTION_POOL: Record<string, string[]> = {
  月: ['月光下的森林', '月下独酌', '月色朦胧的湖面', '月夜星空'],
  雪: ['雪山日出', '雪中红梅', '雪原驰骋', '雪夜灯火'],
  风: ['风吹麦浪', '风云变幻', '风中凌乱的长发', '风暴前夕'],
  星: ['星空银河', '星际穿越', '星辰大海', '星夜中的小镇'],
  海: ['海边日落', '海浪拍岸', '海底世界', '海天一色'],
  花: ['花开满园', '花间蝴蝶', '花瓣飘落', '花与少女'],
  城: ['未来城市建筑', '城市夜景', '城市天际线', '城墙古韵'],
  abstract: ['abstract fluid colors', 'abstract geometric shapes', 'abstract light patterns'],
  sunset: ['sunset over mountains', 'sunset beach scene', 'sunset through clouds'],
  forest: ['enchanted forest', 'misty forest morning', 'autumn forest path'],
};

/**
 * Perform a semantic search. Returns mock random similarity scores.
 */
export async function searchSemantic(
  query: string,
): Promise<SemanticSearchResult[]> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

  if (!query.trim()) return [];

  // Generate 6-12 mock results with random scores
  const count = 6 + Math.floor(Math.random() * 7);
  const results: SemanticSearchResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push({
      id: `mock-${Date.now()}-${i}`,
      similarity: Math.round(50 + Math.random() * 50), // 50-100
    });
  }
  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Get search suggestions based on partial query input.
 */
export async function getSearchSuggestions(
  query: string,
): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 100));

  if (!query.trim()) return [];

  const lower = query.toLowerCase();
  const suggestions: string[] = [];

  for (const [, pool] of Object.entries(SUGGESTION_POOL)) {
    for (const s of pool) {
      if (s.toLowerCase().includes(lower)) {
        suggestions.push(s);
      }
    }
  }

  // Deduplicate and limit
  return Array.from(new Set(suggestions)).slice(0, 6);
}
