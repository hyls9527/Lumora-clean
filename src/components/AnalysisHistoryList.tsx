import { useAiAnalysisStore } from "@/stores/ai-analysis-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface AnalysisHistoryListProps {
  imageId: string
}

export function AnalysisHistoryList({ imageId }: AnalysisHistoryListProps) {
  const { t, locale } = useTranslation()
  const history = useAiAnalysisStore((s) => s.getHistory(imageId))

  if (history.length === 0) return null

  const displayedHistory = history.slice(0, 5)

  return (
    <div>
      {displayedHistory.map((entry, index) => (
        <div
          key={entry.analyzedAt}
          className={cn(
            "py-[10px] px-3 rounded-[2px]",
            "bg-transparent hover:bg-accent-subtle",
            "transition-all duration-200 ease-out",
            index === 0 && "border-l-2 border-accent/20",
            index < displayedHistory.length - 1 && "border-b border-border-subtle",
          )}
        >
          {/* Timestamp */}
          <div className="text-[12px] font-sans text-text-faint">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(entry.analyzedAt))}
          </div>

          {/* Summary */}
          <div className="text-[14px] font-sans text-text-secondary leading-relaxed truncate mt-0.5">
            {locale === "zh" ? entry.summaryZh : entry.summary}
          </div>

          {/* Stats line */}
          <div className="text-[12px] font-sans text-text-muted mt-0.5">
            {t("aiAnalysis.history.statsLine")
              .replace("{confidence}", String(entry.avgConfidence))
              .replace("{objects}", String(entry.objectCount))
              .replace("{tags}", String(entry.tagCount))}
          </div>
        </div>
      ))}

      {/* View all link (if more than 5 entries) */}
      {history.length > 5 && (
        <div className="px-3 py-2 text-center">
          <span className="text-[12px] text-text-muted hover:text-accent transition-colors duration-200 ease-out cursor-default">
            {t("aiAnalysis.history.viewAll")}
          </span>
        </div>
      )}
    </div>
  )
}
