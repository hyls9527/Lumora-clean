import { create } from "zustand"
import type { AnalysisResult, AnalysisHistoryEntry, TagSuggestion } from "@/lib/api/analysis"
import { analyzeImage, getAnalysisResult, getAnalysisHistory } from "@/lib/api/analysis"

interface AiAnalysisState {
  results: Map<string, AnalysisResult | null>
  history: Map<string, AnalysisHistoryEntry[]>
  states: Map<string, "idle" | "analyzing" | "complete" | "error">
  progress: Map<string, number>
  errors: Map<string, string | null>
  acceptedTags: Map<string, Set<string>>
  rejectedTags: Map<string, Set<string>>

  // Getters
  getResult: (imageId: string) => AnalysisResult | null
  getHistory: (imageId: string) => AnalysisHistoryEntry[]
  getState: (imageId: string) => "idle" | "analyzing" | "complete" | "error"
  getProgress: (imageId: string) => number
  getError: (imageId: string) => string | null
  isTagAccepted: (imageId: string, tag: string) => boolean
  isTagRejected: (imageId: string, tag: string) => boolean

  // Actions
  triggerAnalysis: (imageId: string) => Promise<void>
  acceptTag: (imageId: string, tag: string) => void
  rejectTag: (imageId: string, tag: string) => void
}

const progressIntervals = new Map<string, ReturnType<typeof setInterval>>()

export const useAiAnalysisStore = create<AiAnalysisState>((set, get) => ({
  results: new Map(),
  history: new Map(),
  states: new Map(),
  progress: new Map(),
  errors: new Map(),
  acceptedTags: new Map(),
  rejectedTags: new Map(),

  getResult: (imageId) => {
    return get().results.get(imageId) ?? null
  },

  getHistory: (imageId) => {
    return get().history.get(imageId) ?? []
  },

  getState: (imageId) => {
    return get().states.get(imageId) ?? "idle"
  },

  getProgress: (imageId) => {
    return get().progress.get(imageId) ?? 0
  },

  getError: (imageId) => {
    return get().errors.get(imageId) ?? null
  },

  isTagAccepted: (imageId, tag) => {
    return get().acceptedTags.get(imageId)?.has(tag) ?? false
  },

  isTagRejected: (imageId, tag) => {
    return get().rejectedTags.get(imageId)?.has(tag) ?? false
  },

  triggerAnalysis: async (imageId) => {
    const existing = progressIntervals.get(imageId)
    if (existing) {
      clearInterval(existing)
      progressIntervals.delete(imageId)
    }

    set((s) => {
      const newStates = new Map(s.states)
      newStates.set(imageId, "analyzing")
      const newProgress = new Map(s.progress)
      newProgress.set(imageId, 0)
      const newErrors = new Map(s.errors)
      newErrors.delete(imageId)
      return { states: newStates, progress: newProgress, errors: newErrors }
    })

    const interval = setInterval(() => {
      const s = get()
      const current = s.progress.get(imageId) ?? 0
      if (current >= 100) {
        clearInterval(interval)
        progressIntervals.delete(imageId)
        set((prev) => {
          const newProgress = new Map(prev.progress)
          newProgress.set(imageId, 100)
          return { progress: newProgress }
        })
        return
      }
      const increment = Math.floor(Math.random() * 8) + 3
      const next = Math.min(current + increment, 100)
      set((prev) => {
        const newProgress = new Map(prev.progress)
        newProgress.set(imageId, next)
        return { progress: newProgress }
      })
    }, 200)

    progressIntervals.set(imageId, interval)

    try {
      const result = await analyzeImage(imageId)
      const historyData = await getAnalysisHistory(imageId)

      const existingInterval = progressIntervals.get(imageId)
      if (existingInterval) {
        clearInterval(existingInterval)
        progressIntervals.delete(imageId)
      }

      set((s) => {
        const newResults = new Map(s.results)
        newResults.set(imageId, result)
        const newHistory = new Map(s.history)
        newHistory.set(imageId, historyData)
        const newStates = new Map(s.states)
        newStates.set(imageId, "complete")
        const newProgress = new Map(s.progress)
        newProgress.set(imageId, 100)
        return {
          results: newResults,
          history: newHistory,
          states: newStates,
          progress: newProgress,
        }
      })
    } catch (err) {
      console.error("triggerAnalysis failed:", err)

      const existingInterval = progressIntervals.get(imageId)
      if (existingInterval) {
        clearInterval(existingInterval)
        progressIntervals.delete(imageId)
      }

      set((s) => {
        const newStates = new Map(s.states)
        newStates.set(imageId, "error")
        const newErrors = new Map(s.errors)
        newErrors.set(imageId, String(err))
        return { states: newStates, errors: newErrors }
      })
    }
  },

  acceptTag: (imageId, tag) => {
    set((s) => {
      const existing = s.acceptedTags.get(imageId)
      const newSet = new Set(existing ?? [])
      newSet.add(tag)
      const newAcceptedTags = new Map(s.acceptedTags)
      newAcceptedTags.set(imageId, newSet)
      return { acceptedTags: newAcceptedTags }
    })
  },

  rejectTag: (imageId, tag) => {
    set((s) => {
      const existing = s.rejectedTags.get(imageId)
      const newSet = new Set(existing ?? [])
      newSet.add(tag)
      const newRejectedTags = new Map(s.rejectedTags)
      newRejectedTags.set(imageId, newSet)
      return { rejectedTags: newRejectedTags }
    })
  },
}))
