// ---------------------------------------------------------------------------
// AI Analysis API stub — mock data with simulated delay
// ---------------------------------------------------------------------------

export interface AnalysisTag {
  name: string;
  confidence: number; // 0-1
}

export interface AnalysisResult {
  description: string;
  tags: AnalysisTag[];
  objects: string[];
  colorPalette: string[];
  composition: string;
}

export interface AnalysisHistoryItem {
  id: string;
  imageId: string;
  result: AnalysisResult;
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// In-memory mock store
// ---------------------------------------------------------------------------

const mockResults = new Map<string, AnalysisResult>();
const mockHistory = new Map<string, AnalysisHistoryItem[]>();

const MOCK_DESCRIPTIONS = [
  '一幅充满诗意的山水画，远处群山层叠，近处溪水潺潺，意境悠远宁静。',
  '赛博朋克风格的城市夜景，霓虹灯光映照在湿润的街道上，未来感十足。',
  '一位身着古装的女子站在樱花树下，花瓣纷飞，画面唯美而梦幻。',
  '抽象几何构成，柔和的暖色调渐变，给人以平静和冥想的感受。',
  '微距摄影风格的花卉特写，露珠晶莹剔透，光影层次丰富。',
  '极简主义建筑摄影，线条简洁有力，光影对比强烈，构图精妙。',
];

const MOCK_TAG_SETS: AnalysisTag[][] = [
  [
    { name: '风景', confidence: 0.95 },
    { name: '山水', confidence: 0.92 },
    { name: '自然', confidence: 0.88 },
    { name: '中国风', confidence: 0.85 },
    { name: '水墨', confidence: 0.72 },
  ],
  [
    { name: '赛博朋克', confidence: 0.97 },
    { name: '城市', confidence: 0.94 },
    { name: '夜景', confidence: 0.91 },
    { name: '霓虹', confidence: 0.86 },
    { name: '科幻', confidence: 0.79 },
  ],
  [
    { name: '古风', confidence: 0.96 },
    { name: '人物', confidence: 0.93 },
    { name: '樱花', confidence: 0.89 },
    { name: '唯美', confidence: 0.84 },
    { name: '梦幻', confidence: 0.76 },
  ],
  [
    { name: '抽象', confidence: 0.94 },
    { name: '几何', confidence: 0.91 },
    { name: '渐变', confidence: 0.87 },
    { name: '暖色', confidence: 0.82 },
    { name: '极简', confidence: 0.74 },
  ],
  [
    { name: '微距', confidence: 0.96 },
    { name: '花卉', confidence: 0.93 },
    { name: '露珠', confidence: 0.88 },
    { name: '自然', confidence: 0.85 },
    { name: '特写', confidence: 0.77 },
  ],
  [
    { name: '建筑', confidence: 0.95 },
    { name: '极简', confidence: 0.92 },
    { name: '线条', confidence: 0.87 },
    { name: '光影', confidence: 0.83 },
    { name: '现代', confidence: 0.75 },
  ],
];

const MOCK_OBJECTS_SETS = [
  ['山峦', '溪流', '松树', '云雾'],
  ['摩天大楼', '霓虹灯', '街道', '车辆'],
  ['人物', '樱花树', '花瓣', '古建筑'],
  ['几何图形', '渐变色块'],
  ['花瓣', '露珠', '茎叶'],
  ['建筑外墙', '玻璃窗', '阴影'],
];

const MOCK_PALETTES = [
  ['#2d4a3e', '#5c7a5e', '#8fa88f', '#c4d4b8', '#e8efe0'],
  ['#1a1a2e', '#16213e', '#e94560', '#0f3460', '#533483'],
  ['#f4c2c2', '#fce4ec', '#fff0f5', '#d4a5a5', '#8b5e5e'],
  ['#f5e6cc', '#e8c9a0', '#d4a574', '#c2895a', '#a0683c'],
  ['#2e4057', '#048a81', '#54c6eb', '#8ee3ef', '#c7f0db'],
  ['#2a2118', '#6b5d48', '#a09480', '#c4b89e', '#f2ede4'],
];

const MOCK_COMPOSITIONS = [
  '三分法构图，前景、中景、远景层次分明，留白恰到好处',
  '对称构图，视线沿街道纵深延伸，引导视觉焦点',
  '中心构图，主体居中，背景虚化突出人物，色彩和谐',
  '自由构图，色块间的平衡与呼应形成视觉节奏',
  '微距特写构图，景深极浅，主体清晰背景柔和虚化',
  '极简构图，大面积留白与线条形成强烈对比，简洁有力',
];

function generateMockResult(): AnalysisResult {
  const idx = Math.floor(Math.random() * MOCK_DESCRIPTIONS.length);
  return {
    description: MOCK_DESCRIPTIONS[idx],
    tags: MOCK_TAG_SETS[idx],
    objects: MOCK_OBJECTS_SETS[idx],
    colorPalette: MOCK_PALETTES[idx],
    composition: MOCK_COMPOSITIONS[idx],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Analyze an image — returns a mock result after a 3-second delay. */
export async function analyzeImage(imageId: string): Promise<AnalysisResult> {
  await new Promise((r) => setTimeout(r, 3000));

  const result = generateMockResult();
  mockResults.set(imageId, result);

  // Append to history
  const existing = mockHistory.get(imageId) ?? [];
  existing.unshift({
    id: `hist-${Date.now()}`,
    imageId,
    result,
    analyzedAt: new Date().toISOString(),
  });
  mockHistory.set(imageId, existing);

  return result;
}

/** Get the most recent analysis result for an image. */
export function getAnalysisResult(imageId: string): AnalysisResult | null {
  return mockResults.get(imageId) ?? null;
}

/** Get analysis history for an image. */
export function getAnalysisHistory(imageId: string): AnalysisHistoryItem[] {
  return mockHistory.get(imageId) ?? [];
}
