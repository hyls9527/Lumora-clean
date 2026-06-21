// Mock API — all functions return browser-only mock data

export interface TagSuggestion {
  label: string
  labelZh: string
  confidence: number
}

export interface AnalysisResult {
  imageId: string
  description: string
  descriptionZh: string
  tags: TagSuggestion[]
  objects: string[]
  objectsZh: string[]
  palette: string[]
  composition: string
  compositionZh: string
  analyzedAt: string
}

export interface AnalysisHistoryEntry {
  imageId: string
  analyzedAt: string
  summary: string
  summaryZh: string
  avgConfidence: number
  objectCount: number
  tagCount: number
}

const DESCRIPTIONS_EN = [
  "A golden sunset casting warm light over mountain ridges, with silhouetted pine trees in the foreground",
  "A minimalist architectural interior with geometric shadows falling across polished concrete floors",
  "A serene forest stream winding through moss-covered rocks under a canopy of birch trees",
  "A dramatic coastal landscape with waves crashing against weathered cliffs under a stormy sky",
  "A quiet urban street at twilight, with warm amber light spilling from shop windows onto cobblestones",
  "An intimate portrait with soft natural lighting, shallow depth of field, and warm skin tones",
  "A vast desert landscape with wind-sculpted sand dunes stretching to the horizon at golden hour",
  "A lush botanical garden with layered foliage, dappled sunlight filtering through a canopy of leaves",
]

const DESCRIPTIONS_ZH = [
  "金色夕阳洒落在山脊之上，前景中松树的剪影静立",
  "极简建筑室内，几何阴影落在抛光混凝土地板上",
  "静谧的森林溪流蜿蜒穿过苔藓覆盖的岩石，桦树冠层之下",
  "壮丽的海岸风光，暴风雨天空下海浪拍打着风化的悬崖",
  "黄昏时分宁静的城市街道，温暖琥珀色灯光从店铺窗户洒向鹅卵石路面",
]

const TAG_POOL: { label: string; labelZh: string }[] = [
  { label: "sunset", labelZh: "日落" },
  { label: "mountains", labelZh: "山峰" },
  { label: "landscape", labelZh: "风景" },
  { label: "portrait", labelZh: "人像" },
  { label: "architecture", labelZh: "建筑" },
  { label: "nature", labelZh: "自然" },
  { label: "minimalist", labelZh: "极简" },
  { label: "forest", labelZh: "森林" },
  { label: "water", labelZh: "水景" },
  { label: "urban", labelZh: "城市" },
  { label: "golden hour", labelZh: "黄金时刻" },
  { label: "abstract", labelZh: "抽象" },
]

const OBJECTS_EN = [
  "mountain",
  "sunset",
  "tree",
  "sky",
  "cloud",
  "water",
  "building",
  "person",
  "flower",
  "animal",
  "rock",
  "grass",
  "shadow",
  "light",
  "bridge",
]

const OBJECTS_ZH = [
  "山峰",
  "日落",
  "树木",
  "天空",
  "云朵",
  "水景",
  "建筑",
  "人物",
  "花卉",
  "动物",
  "岩石",
  "草地",
  "阴影",
  "光线",
  "桥梁",
]

const PALETTE_POOL = [
  "#d4a574",
  "#8b6914",
  "#2a2118",
  "#4a7a3a",
  "#c4b89e",
  "#7a5c12",
  "#6b5d48",
  "#a09480",
  "#f2ede4",
  "#ebe5d8",
]

const COMPOSITIONS_EN = [
  "A balanced composition with the horizon placed on the lower third, leading the eye from foreground to background",
  "Strong leading lines draw the eye from foreground to background, creating depth and perspective",
  "Centered subject with symmetrical framing and shallow depth of field emphasizing the main focal point",
  "Rule of thirds applied with the main subject offset to the left, creating visual tension and balance",
  "Diagonal flow from bottom-left to top-right creates dynamic movement across the frame",
]

const COMPOSITIONS_ZH = [
  "平衡的构图，地平线位于下三分之一处，引导视线从前景到背景",
  "强烈的引导线将视线从前景引向背景，营造深度与透视感",
  "居中主体配合对称框架，浅景深突出主要焦点",
  "三分法则运用，主体偏左，创造视觉张力与平衡",
  "从左下到右上的对角线流动，营造画面的动态感",
]

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function getImageSeed(imageId: string): number {
  const match = imageId.match(/img-(\d+)/)
  return match ? Number(match[1]) : 0
}

function generateMockResult(imageId: string): AnalysisResult {
  const seed = getImageSeed(imageId)

  const description = DESCRIPTIONS_EN[seed % DESCRIPTIONS_EN.length]
  const descriptionZh = DESCRIPTIONS_ZH[seed % DESCRIPTIONS_ZH.length]

  const tagCount = (seed % 4) + 3
  const tagEntries = pickRandom(TAG_POOL, tagCount)
  const tags: TagSuggestion[] = tagEntries.map((t) => ({
    label: t.label,
    labelZh: t.labelZh,
    confidence: Math.floor(Math.random() * 70) + 30,
  }))

  const objectCount = (seed % 6) + 3
  const objects = pickRandom(OBJECTS_EN, objectCount)
  const objectsZh = objects.map((obj) => {
    const idx = OBJECTS_EN.indexOf(obj)
    return OBJECTS_ZH[idx] ?? obj
  })

  const palette = pickRandom(PALETTE_POOL, 5)

  const composition = COMPOSITIONS_EN[seed % COMPOSITIONS_EN.length]
  const compositionZh = COMPOSITIONS_ZH[seed % COMPOSITIONS_ZH.length]

  return {
    imageId,
    description,
    descriptionZh,
    tags,
    objects,
    objectsZh,
    palette,
    composition,
    compositionZh,
    analyzedAt: new Date().toISOString(),
  }
}

export async function analyzeImage(imageId: string): Promise<AnalysisResult> {
  await new Promise((r) => setTimeout(r, Math.random() * 1600 + 1200))
  return generateMockResult(imageId)
}

export async function getAnalysisResult(imageId: string): Promise<AnalysisResult | null> {
  await new Promise((r) => setTimeout(r, 80))
  return generateMockResult(imageId)
}

export async function getAnalysisHistory(imageId: string): Promise<AnalysisHistoryEntry[]> {
  await new Promise((r) => setTimeout(r, 100))
  const seed = getImageSeed(imageId)
  const entryCount = (seed % 5) + 1
  const entries: AnalysisHistoryEntry[] = []

  for (let i = 0; i < entryCount; i++) {
    const daysAgo = i * (Math.floor(Math.random() * 2) + 1)
    const analyzedAt = new Date(Date.now() - daysAgo * 86400000).toISOString()
    const result = generateMockResult(imageId)
    const summary = result.description.slice(0, 60) + "..."
    const summaryZh = result.descriptionZh.slice(0, 60) + "…"
    const avgConfidence = Math.floor(Math.random() * 51) + 45
    const objectCount = (seed + i) % 7 + 2
    const tagCount = (seed + i) % 5 + 2

    entries.push({
      imageId,
      analyzedAt,
      summary,
      summaryZh,
      avgConfidence,
      objectCount,
      tagCount,
    })
  }

  entries.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
  return entries
}
