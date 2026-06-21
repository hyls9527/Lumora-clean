import { useState, useEffect } from "react"
import { useAiAnalysisStore } from "@/stores/ai-analysis-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { TagSuggestionCard } from "@/components/TagSuggestionCard"
import { ColorPaletteStrip } from "@/components/ColorPaletteStrip"
import { AnalysisHistoryList } from "@/components/AnalysisHistoryList"

interface AiAnalysisSectionProps {
  imageId: string
}

export function AiAnalysisSection({ imageId }: AiAnalysisSectionProps) {
  const { t, locale } = useTranslation()

  const result = useAiAnalysisStore((s) => s.getResult(imageId))
  const state = useAiAnalysisStore((s) => s.getState(imageId))
  const progress = useAiAnalysisStore((s) => s.getProgress(imageId))
  const error = useAiAnalysisStore((s) => s.getError(imageId))
  const triggerAnalysis = useAiAnalysisStore((s) => s.triggerAnalysis)
  const rejectedTags = useAiAnalysisStore((s) => s.rejectedTags.get(imageId) ?? new Set<string>())
  const acceptedTags = useAiAnalysisStore((s) => s.acceptedTags.get(imageId) ?? new Set<string>())

  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (state === "complete") {
      setShowResults(true)
    }
  }, [state])

  // ── idle: no analysis ever performed ──────────────────────────────

  if (state === "idle") {
    return (
      <div className="space-y-3">
        <SectionLabel>{t("aiAnalysis.sectionLabel")}</SectionLabel>
        <p className="text-[14px] text-text-muted font-sans leading-relaxed">
          {t("aiAnalysis.empty.body")}
        </p>
        <button
          type="button"
          onClick={() => triggerAnalysis(imageId)}
          className={cn(
            "h-8 px-5 mt-2 rounded-[4px]",
            "bg-accent text-surface text-[12px] font-sans",
            "hover:bg-accent-hover",
            "focus-visible:ring-1 focus-visible:ring-accent/20",
            "transition-all duration-200 ease-out",
          )}
        >
          {t("aiAnalysis.cta.analyze")}
        </button>
      </div>
    )
  }

  // ── analyzing: progress bar ────────────────────────────────────────

  if (state === "analyzing") {
    return (
      <div className="space-y-3">
        <SectionLabel>{t("aiAnalysis.sectionLabel")}</SectionLabel>
        <div>
          <div className="w-full h-1 rounded-[2px] bg-accent/20">
            <div
              className="h-1 rounded-[2px] bg-accent transition-all duration-200 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[12px] font-sans text-text-muted text-right mt-1">
            {t("aiAnalysis.cta.analyzing")}
          </p>
        </div>
      </div>
    )
  }

  // ── complete: all sub-sections ─────────────────────────────────────

  if (state === "complete" && result) {
    const visibleTags = result.tags.filter((tag) => !rejectedTags.has(tag.label))
    const allTagsReviewed =
      result.tags.length > 0 &&
      result.tags.every(
        (tag) => acceptedTags.has(tag.label) || rejectedTags.has(tag.label),
      )

    return (
      <div
        className={cn(
          "space-y-3 transition-opacity duration-200 ease-out",
          showResults ? "opacity-100" : "opacity-0",
        )}
      >
        <SectionLabel>{t("aiAnalysis.sectionLabel")}</SectionLabel>

        {/* Description */}
        {result.description && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint font-sans">
              {t("aiAnalysis.description.heading")}
            </span>
            <p className="text-[14px] font-sans text-text-secondary leading-[1.6]">
              {locale === "zh" ? result.descriptionZh : result.description}
            </p>
          </div>
        )}

        {/* Tag Suggestions */}
        {result.tags.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint font-sans">
              {t("aiAnalysis.tags.heading")}
            </span>
            <div className="flex flex-col gap-1">
              {visibleTags.map((tag) => (
                <TagSuggestionCard
                  key={tag.label}
                  imageId={imageId}
                  tag={tag}
                />
              ))}
            </div>
            {allTagsReviewed && (
              <p className="text-[12px] font-sans text-text-faint">
                {t("aiAnalysis.tags.allReviewed")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-text-faint font-sans">
            {t("aiAnalysis.tags.none")}
          </p>
        )}

        {/* Content Analysis: Objects */}
        {result.objects.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint font-sans">
              {t("aiAnalysis.objects.heading")}
            </span>
            <div className="flex flex-wrap gap-1">
              {(locale === "zh" ? result.objectsZh : result.objects)
                .slice(0, 5)
                .map((obj) => (
                  <span
                    key={obj}
                    className="text-[12px] font-sans text-text-secondary bg-bg rounded-[4px] px-2 py-0.5"
                  >
                    {obj}
                  </span>
                ))}
              {result.objects.length > 5 && (
                <span className="text-[12px] text-text-muted font-sans">
                  {t("aiAnalysis.objects.overflow").replace(
                    "{n}",
                    String(result.objects.length - 5),
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Analysis: Palette */}
        {result.palette.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint font-sans">
              {t("aiAnalysis.palette.heading")}
            </span>
            <ColorPaletteStrip palette={result.palette} />
          </div>
        )}

        {/* Content Analysis: Composition */}
        {result.composition && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint font-sans">
              {t("aiAnalysis.composition.heading")}
            </span>
            <p className="text-[14px] font-sans text-text-secondary leading-[1.6]">
              {locale === "zh" ? result.compositionZh : result.composition}
            </p>
          </div>
        )}

        {/* Analysis History */}
        <AnalysisHistoryList imageId={imageId} />

        {/* Re-analyze link */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => triggerAnalysis(imageId)}
            className="text-[12px] font-sans text-text-muted hover:text-accent hover:underline transition-colors duration-200 ease-out"
          >
            {t("aiAnalysis.cta.reanalyze")}
          </button>
        </div>
      </div>
    )
  }

  // ── error ──────────────────────────────────────────────────────────

  if (state === "error") {
    return (
      <div className="space-y-3">
        <SectionLabel>{t("aiAnalysis.sectionLabel")}</SectionLabel>
        <p className="text-[14px] font-sans text-danger text-center">
          {t("aiAnalysis.error.unavailable")}
        </p>
        <button
          type="button"
          onClick={() => triggerAnalysis(imageId)}
          className="text-[12px] font-sans text-accent hover:underline transition-colors duration-200 ease-out"
        >
          {t("aiAnalysis.cta.retry")}
        </button>
        <button
          type="button"
          onClick={() => triggerAnalysis(imageId)}
          className={cn(
            "h-8 px-5 rounded-[4px]",
            "bg-accent text-surface text-[12px] font-sans",
            "hover:bg-accent-hover",
            "focus-visible:ring-1 focus-visible:ring-accent/20",
            "transition-all duration-200 ease-out",
          )}
        >
          {t("aiAnalysis.cta.analyze")}
        </button>
      </div>
    )
  }

  return null
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[9px] uppercase tracking-[0.1em] text-text-faint font-sans">
      {children}
    </h3>
  )
}
