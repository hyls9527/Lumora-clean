import { useState, useEffect, useRef } from "react"
import type { TagSuggestion } from "@/lib/api/analysis"
import { useAiAnalysisStore } from "@/stores/ai-analysis-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface TagSuggestionCardProps {
  imageId: string
  tag: TagSuggestion
}

export function TagSuggestionCard({ imageId, tag }: TagSuggestionCardProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(true)

  const isAccepted = useAiAnalysisStore((s) => s.isTagAccepted(imageId, tag.label))
  const isRejected = useAiAnalysisStore((s) => s.isTagRejected(imageId, tag.label))
  const acceptTag = useAiAnalysisStore((s) => s.acceptTag)
  const rejectTag = useAiAnalysisStore((s) => s.rejectTag)

  const acceptRef = useRef<HTMLButtonElement>(null)
  const rejectRef = useRef<HTMLButtonElement>(null)

  // Accepted: collapse after 1500ms
  useEffect(() => {
    if (isAccepted) {
      const timer = setTimeout(() => setVisible(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isAccepted])

  // Rejected: collapse immediately
  useEffect(() => {
    if (isRejected) {
      setVisible(false)
    }
  }, [isRejected])

  // Collapsed state — hide entirely
  if (!visible) {
    return (
      <div className="opacity-0 max-h-0 overflow-hidden transition-all duration-200 ease-out pointer-events-none" />
    )
  }

  const confidenceColor =
    tag.confidence > 80
      ? "bg-accent"
      : tag.confidence >= 50
        ? "bg-text-secondary/30"
        : "bg-text-muted/20"

  const confidenceTextColor =
    tag.confidence > 80
      ? "text-accent"
      : tag.confidence >= 50
        ? "text-text-secondary"
        : "text-text-muted"

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      acceptRef.current?.focus()
    } else if (e.key === "ArrowRight" && document.activeElement === acceptRef.current) {
      e.preventDefault()
      rejectRef.current?.focus()
    } else if (e.key === "ArrowLeft" && document.activeElement === rejectRef.current) {
      e.preventDefault()
      acceptRef.current?.focus()
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2",
        "bg-surface border border-border rounded-[2px]",
        "hover:bg-accent-subtle hover:border-accent/20",
        "focus-visible:ring-1 focus-visible:ring-accent/20 focus-visible:outline-none",
        "transition-all duration-200 ease-out",
        isAccepted &&
          "bg-[rgba(74,122,58,0.05)] border-success/20 hover:bg-[rgba(74,122,58,0.05)] hover:border-success/20",
      )}
    >
      {/* Left: tag label */}
      <span className="text-[12px] font-sans text-text-secondary shrink-0">
        {tag.label}
      </span>

      {/* Middle: confidence bar + percentage */}
      <div className="flex items-center gap-2 flex-1 mx-3">
        <div className="flex-1 h-1 rounded-[2px] bg-bg overflow-hidden">
          <div
            className={cn("h-full rounded-[2px] transition-all duration-200 ease-out", confidenceColor)}
            style={{ width: `${tag.confidence}%` }}
          />
        </div>
        <span className={cn("text-[11px] font-mono shrink-0 tabular-nums", confidenceTextColor)}>
          {t("aiAnalysis.tags.confidence").replace("{n}", String(tag.confidence))}
        </span>
      </div>

      {/* Right: Accept / Reject buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          ref={acceptRef}
          onClick={(e) => {
            e.stopPropagation()
            acceptTag(imageId, tag.label)
          }}
          className="text-[12px] font-sans text-success hover:underline transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:underline"
        >
          {t("aiAnalysis.tags.accept")}
        </button>
        <button
          ref={rejectRef}
          onClick={(e) => {
            e.stopPropagation()
            rejectTag(imageId, tag.label)
          }}
          className="text-[12px] font-sans text-text-muted hover:text-danger transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:text-danger"
        >
          {t("aiAnalysis.tags.reject")}
        </button>
      </div>
    </div>
  )
}
