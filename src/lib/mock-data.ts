export type AspectRatio = '1/1' | '4/3' | '3/4' | '16/9' | '3/2' | '2/3' | '9/16'

export interface Tag {
  name: string
  color: string
}

export const MOCK_TAGS: Tag[] = [
  { name: "portrait", color: "amber" },
  { name: "landscape", color: "emerald" },
  { name: "anime", color: "rose" },
  { name: "cyberpunk", color: "sky" },
  { name: "painting", color: "stone" },
  { name: "abstract", color: "violet" },
  { name: "fantasy", color: "amber" },
  { name: "food", color: "stone" },
  { name: "nature", color: "emerald" },
  { name: "city", color: "sky" },
  { name: "still-life", color: "stone" },
  { name: "b&w", color: "stone" },
  { name: "minimalist", color: "amber" },
  { name: "concept-art", color: "violet" },
  { name: "impressionist", color: "rose" },
  { name: "neon", color: "sky" },
  { name: "cherry-blossom", color: "rose" },
  { name: "mountains", color: "emerald" },
  { name: "sunset", color: "amber" },
  { name: "studio", color: "stone" },
]

export interface Image {
  id: string
  path: string
  thumbnail: string
  width: number
  height: number
  sizeKb: number
  format: string
  rating: number
  favorite: boolean
  tags: string[]
  createdAt: string
  aspectRatio: AspectRatio
  analysis?: {
    subject?: { characters?: string[]; features?: string[] }
    style?: { art_movement?: string[]; render_type?: string[]; quality_tags?: string[] }
    composition?: { framing?: string; camera_angle?: string }
    visual?: { color_palette?: string[]; lighting?: string }
    generation?: { prompt?: string; negative_prompt?: string; model?: string; sampler?: string; steps?: number; cfg_scale?: number }
  }
  score?: { composition: number; technical: number; subject: number; style: number; color: number; novelty: number }
}

const PROMPTS = [
  "masterpiece, best quality, 1girl, silver hair, blue eyes, school uniform, cherry blossoms",
  "landscape, mountains, sunset, golden hour, dramatic clouds, 8k, photorealistic",
  "cyberpunk city, neon lights, rain, reflections, futuristic, blade runner style",
  "oil painting, still life, flowers in vase, impressionist, soft lighting",
  "abstract art, geometric shapes, vibrant colors, modern, gallery wall",
  "portrait, elderly man, wrinkles, wisdom, black and white, studio lighting",
  "fantasy castle, floating islands, magic, ethereal, concept art, matte painting",
  "food photography, sushi, wooden board, wasabi, minimalist, top view",
]

const TAG_SETS = [
  ["portrait", "anime", "school", "cherry-blossom"],
  ["landscape", "nature", "sunset", "mountains"],
  ["cyberpunk", "city", "neon", "rain"],
  ["painting", "still-life", "flowers", "impressionist"],
  ["abstract", "geometric", "modern", "gallery"],
  ["portrait", "b&w", "elderly", "studio"],
  ["fantasy", "castle", "magic", "concept-art"],
  ["food", "sushi", "minimalist", "photography"],
]

const ASPECT_RATIOS: AspectRatio[] = ['1/1', '4/3', '3/4', '16/9', '3/2', '2/3', '9/16', '1/1', '4/3']

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

const PLACEHOLDER_COLORS = [
  '#e8d5b7', '#c9b896', '#b8a07a', '#d4c4a8', '#a89070',
  '#dcc8a0', '#bfab85', '#e0cfb0', '#c4ae8e', '#d2bc98',
]

function placeholderSvg(seed: number, w: number, h: number): string {
  const bg = PLACEHOLDER_COLORS[seed % PLACEHOLDER_COLORS.length]
  const fg = '#8a7a60'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="serif" font-size="14" fill="${fg}">${w}×${h}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function generateMockImages(count: number): Image[] {
  const images: Image[] = []
  for (let i = 0; i < count; i++) {
    const idx = i % PROMPTS.length
    const w = pick([512, 768, 1024, 1536])
    const h = pick([512, 768, 1024, 1536])
    images.push({
      id: `img-${i}`,
      path: `D:/Gallery/${String(i).padStart(4, "0")}.png`,
      thumbnail: placeholderSvg(i, w, h),
      width: w,
      height: h,
      sizeKb: rand(200, 8000),
      format: pick(["png", "jpg", "webp"]),
      rating: rand(0, 5),
      favorite: Math.random() > 0.8,
      tags: TAG_SETS[idx],
      createdAt: new Date(Date.now() - rand(0, 90 * 86400000)).toISOString(),
      aspectRatio: ASPECT_RATIOS[i % ASPECT_RATIOS.length],
      analysis: {
        subject: { characters: TAG_SETS[idx].slice(0, 2), features: TAG_SETS[idx].slice(2) },
        style: { art_movement: [pick(["anime", "realistic", "impressionist", "cyberpunk"])], render_type: [pick(["digital", "oil", "photograph"])], quality_tags: ["masterpiece", "best quality"] },
        composition: { framing: pick(["center", "rule-of-thirds", "symmetric"]), camera_angle: pick(["eye-level", "low-angle", "bird-eye"]) },
        visual: { color_palette: ["#7c5bf5", "#f59e0b", "#22c55e", "#ef4444"], lighting: pick(["soft", "dramatic", "natural", "studio"]) },
        generation: { prompt: PROMPTS[idx], negative_prompt: "low quality, blurry, deformed", model: pick(["SDXL", "SD1.5", "Pony"]), sampler: pick(["Euler a", "DPM++ 2M", "DDIM"]), steps: rand(20, 50), cfg_scale: rand(5, 12) },
      },
      score: { composition: rand(40, 95), technical: rand(40, 95), subject: rand(40, 95), style: rand(40, 95), color: rand(40, 95), novelty: rand(40, 95) },
    })
  }
  return images
}
