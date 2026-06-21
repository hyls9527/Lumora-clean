import { create } from "zustand"
import type { EmbeddingStatus, BatchGenerationState } from "@/lib/api/embeddings"
import {
  getEmbeddingStatus,
  generateEmbeddings as apiGenerateEmbeddings,
  cancelEmbeddingGeneration,
} from "@/lib/api/embeddings"
import type { Image } from "@/lib/mock-data"

interface EmbeddingState {
  statuses: Map<string, EmbeddingStatus>
  batch: BatchGenerationState | null
  isGenerating: boolean
  isLoading: boolean
  error: string | null

  // Getters
  getStatus: (imageId: string) => EmbeddingStatus
  embeddedCount: () => number
  pendingCount: () => number
  errorCount: () => number

  // Actions
  loadStatuses: () => Promise<void>
  generateEmbeddings: (ids: string[]) => Promise<void>
  cancelGeneration: () => Promise<void>
}

function generateMockEmbeddingStatuses(totalImages: number): Map<string, EmbeddingStatus> {
  const map = new Map<string, EmbeddingStatus>()
  for (let i = 0; i < totalImages; i++) {
    const imageId = `img-${i}`
    const bucket = i % 100
    if (bucket < 70) {
      const daysAgo = Math.floor(Math.random() * 30) + 1
      const generatedAt = new Date(Date.now() - daysAgo * 86400000).toISOString()
      map.set(imageId, {
        imageId,
        status: "embedded",
        dimensions: 1536,
        model: "clip-vit-base-patch32",
        generatedAt,
      })
    } else if (bucket >= 70 && bucket < 95) {
      map.set(imageId, { imageId, status: "pending" })
    } else {
      map.set(imageId, {
        imageId,
        status: "error",
        errorMessage: "Model inference failed — CUDA out of memory",
      })
    }
  }
  return map
}

let progressInterval: ReturnType<typeof setInterval> | null = null

export const useEmbeddingStore = create<EmbeddingState>((set, get) => ({
  statuses: generateMockEmbeddingStatuses(200),
  batch: null,
  isGenerating: false,
  isLoading: false,
  error: null,

  getStatus: (imageId) => {
    const s = get()
    return s.statuses.get(imageId) || { imageId, status: "pending" }
  },

  embeddedCount: () => {
    let count = 0
    get().statuses.forEach((s) => {
      if (s.status === "embedded") count++
    })
    return count
  },

  pendingCount: () => {
    let count = 0
    get().statuses.forEach((s) => {
      if (s.status === "pending") count++
    })
    return count
  },

  errorCount: () => {
    let count = 0
    get().statuses.forEach((s) => {
      if (s.status === "error") count++
    })
    return count
  },

  loadStatuses: async () => {
    set({ isLoading: true, error: null })
    try {
      const allIds = Array.from({ length: 200 }, (_, i) => `img-${i}`)
      const results = await getEmbeddingStatus(allIds)
      if (results.length > 0) {
        const map = new Map<string, EmbeddingStatus>()
        results.forEach((s) => map.set(s.imageId, s))
        set({ statuses: map, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch (err) {
      console.error("loadStatuses failed:", err)
      set({ error: String(err), isLoading: false })
    }
  },

  generateEmbeddings: async (ids) => {
    set({ isGenerating: true, error: null })
    try {
      const { batchId } = await apiGenerateEmbeddings(ids)
      set({
        batch: { batchId, total: ids.length, current: 0, status: "generating" },
      })

      progressInterval = setInterval(() => {
        const s = get()
        if (!s.batch || s.batch.status !== "generating") {
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          return
        }
        const increment = Math.floor(Math.random() * 5) + 1
        const next = Math.min(s.batch.current + increment, s.batch.total)
        if (next >= s.batch.total) {
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          set({
            batch: { ...s.batch, current: s.batch.total, status: "complete" },
            isGenerating: false,
          })
        } else {
          set({
            batch: { ...s.batch, current: next },
          })
        }
      }, 200)
    } catch (err) {
      console.error("generateEmbeddings failed:", err)
      set({ error: String(err), isGenerating: false })
    }
  },

  cancelGeneration: async () => {
    const { batch } = get()
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
    if (batch && batch.status === "generating") {
      try {
        await cancelEmbeddingGeneration(batch.batchId)
      } catch (err) {
        console.error("cancelGeneration failed:", err)
      }
    }
    set({ batch: null, isGenerating: false })
  },
}))
