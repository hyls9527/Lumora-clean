import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface EmbeddingStatusBadgeProps {
  status: "embedded" | "pending" | "error"
  generatedAt?: string
  errorMessage?: string
  className?: string
}

export function EmbeddingStatusBadge({
  status,
  generatedAt,
  errorMessage,
  className,
}: EmbeddingStatusBadgeProps) {
  const { t } = useTranslation()

  const statusLabel = t(`embedding.status.${status}`)

  let marker: string
  let tooltipText: string

  switch (status) {
    case "embedded": {
      marker = "✓"
      const formattedDate = generatedAt
        ? new Date(generatedAt).toLocaleDateString()
        : ""
      tooltipText = t("embedding.tooltip.embedded").replace("{date}", formattedDate)
      break
    }
    case "pending": {
      marker = "○"
      tooltipText = t("embedding.tooltip.pending")
      break
    }
    case "error": {
      marker = "✗"
      tooltipText = errorMessage
        ? `${t("embedding.tooltip.error")}: ${errorMessage}`
        : t("embedding.tooltip.error")
      break
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium font-sans uppercase tracking-[0.1em] transition-all duration-200 ease-out",
            status === "embedded" &&
              "bg-accent-subtle border border-accent/20 text-accent",
            status === "pending" &&
              "bg-transparent border border-border text-text-muted",
            status === "error" &&
              "bg-danger/5 border border-danger/20 text-danger",
            className,
          )}
        >
          {marker}
          {" "}
          {statusLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] font-sans">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}
