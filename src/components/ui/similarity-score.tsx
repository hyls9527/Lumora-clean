import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface SimilarityScoreProps {
  score: number        // 0-100
  showTooltip?: boolean // default true
  className?: string
}

export function SimilarityScore({
  score,
  showTooltip = true,
  className,
}: SimilarityScoreProps) {
  const { t } = useTranslation()

  const label = t("semanticSearch.score.label").replace("{n}", String(score))

  const badge = (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-[4px] font-mono text-[11px] tabular-nums",
        score > 80 &&
          "text-accent bg-accent-subtle border border-accent/20",
        score >= 50 && score <= 80 &&
          "text-text-secondary bg-transparent border border-border",
        score < 50 &&
          "text-text-muted bg-transparent border border-border-subtle",
        className,
      )}
    >
      {label}
    </span>
  )

  if (!showTooltip) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] font-sans">
        {t("semanticSearch.score.tooltip")}
      </TooltipContent>
    </Tooltip>
  )
}
