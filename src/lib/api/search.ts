// Mock API — all functions return browser-only mock data

export interface SemanticSearchResult {
  imageId: string
  score: number
}

export interface SearchSuggestions {
  suggestions: string[]
  tryDescribing: string[]
}

const HARDCODED_TERMS = [
  "sunset",
  "mountains",
  "portrait",
  "landscape",
  "architecture",
  "night",
  "water",
  "forest",
  "urban",
  "minimalist",
  "warm lighting",
  "golden hour",
  "abstract",
  "nature",
  "cityscape",
]

export async function searchSemantic(query: string): Promise<SemanticSearchResult[]> {
  if (!query) return []

  // Simulate network latency: 200-600ms
  await new Promise((r) => setTimeout(r, Math.random() * 400 + 200))

  const count = Math.floor(Math.random() * 10) + 5
  const seen = new Set<string>()
  const results: SemanticSearchResult[] = []

  for (let i = 0; i < count; i++) {
    const imageId = `img-${Math.floor(Math.random() * 200)}`
    const score = Math.floor(Math.random() * 60) + 25

    if (seen.has(imageId)) {
      // Keep the highest score for duplicate
      const existing = results.find((r) => r.imageId === imageId)
      if (existing && score > existing.score) {
        existing.score = score
      }
    } else {
      seen.add(imageId)
      results.push({ imageId, score })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestions> {
  if (!query || query.length < 2) return { suggestions: [], tryDescribing: [] }

  // Simulate fast response
  await new Promise((r) => setTimeout(r, 100))

  const lowerQuery = query.toLowerCase()
  const suggestions = HARDCODED_TERMS.filter((term) =>
    term.toLowerCase().startsWith(lowerQuery),
  )

  return {
    suggestions,
    tryDescribing: [
      "sunset over mountains",
      "portrait with warm lighting",
      "minimalist architecture",
    ],
  }
}
