import { useEmbeddingStore } from "@/stores/embedding-store"
import { useToastStore } from "@/stores/toast-store"
import { useTranslation } from "@/lib/i18n"
import { useEffect, useRef, useCallback } from "react"

interface BatchEmbeddingBarProps {
  selectedIds: Set<string>
  onGenerationStart?: () => void
  onGenerationEnd?: () => void
}

export function BatchEmbeddingBar({
  selectedIds,
  onGenerationStart,
  onGenerationEnd,
}: BatchEmbeddingBarProps) {
  const { batch, isGenerating } = useEmbeddingStore()
  const generateEmbeddings = useEmbeddingStore((s) => s.generateEmbeddings)
  const cancelGeneration = useEmbeddingStore((s) => s.cancelGeneration)
  const addToast = useToastStore((s) => s.addToast)
  const { t } = useTranslation()

  const prevStatusRef = useRef(batch?.status)

  useEffect(() => {
    if (!batch) return
    const prev = prevStatusRef.current
    prevStatusRef.current = batch.status

    // Completion: batch just transitioned to 'complete'
    if (batch.status === "complete" && prev === "generating") {
      addToast(t("embedding.toast.success"), "success")
      onGenerationEnd?.()
    }

    // Error: batch just transitioned to 'error'
    if (batch.status === "error" && prev === "generating") {
      addToast(t("embedding.toast.failed"), "warning")
      onGenerationEnd?.()
    }

    // Cancelled: batch just transitioned to 'cancelled'
    if (batch.status === "cancelled") {
      onGenerationEnd?.()
    }
  }, [batch, addToast, t, onGenerationEnd])

  const handleGenerate = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    onGenerationStart?.()
    try {
      await generateEmbeddings(ids)
    } catch {
      // Error is already set in the store; toast will fire via the error branch
    }
  }, [selectedIds, generateEmbeddings, onGenerationStart])

  const handleCancel = useCallback(async () => {
    await cancelGeneration()
    onGenerationEnd?.()
  }, [cancelGeneration, onGenerationEnd])

  const progressPercent =
    batch && batch.total > 0
      ? Math.round((batch.current / batch.total) * 100)
      : 0

  if (selectedIds.size === 0 && !isGenerating) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface border-b border-border-subtle">
      {/* State: Generating */}
      {isGenerating && batch && batch.status === "generating" && (
        <>
          <div className="flex-1 h-1.5 rounded-[2px] bg-accent/20 overflow-hidden">
            <div
              className="h-full rounded-[2px] bg-accent transition-all duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-sans text-[12px] text-text-muted tabular-nums whitespace-nowrap">
            {t("embedding.batch.progress")
              .replace("{n}", String(batch.current))
              .replace("{total}", String(batch.total))}
          </span>
          <button
            onClick={handleCancel}
            className="text-[12px] text-text-muted hover:text-text-secondary transition-all duration-200 ease-out font-sans whitespace-nowrap"
          >
            {t("embedding.cancel")}
          </button>
        </>
      )}

      {/* State: Idle (not generating, has selection) */}
      {!isGenerating && (
        <>
          <span className="font-serif text-[11px] text-text-muted">
            {selectedIds.size} {t("gallery.selected")}
          </span>
          <div className="flex-1" />
          <button
            onClick={handleGenerate}
            className="px-3 py-1.5 rounded-[4px] bg-accent text-surface text-[12px] font-medium font-sans hover:bg-accent-hover transition-all duration-200 ease-out"
          >
            {t("embedding.generate")}
          </button>
        </>
      )}
    </div>
  )
}
