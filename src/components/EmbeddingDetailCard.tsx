import { useEmbeddingStore } from "@/stores/embedding-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface EmbeddingDetailCardProps {
  imageId: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[9px] uppercase tracking-[0.1em] text-text-faint font-sans">
      {children}
    </h3>
  )
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[12px] text-text-faint shrink-0">{label}</span>
      <span
        className={cn(
          "text-[12px] text-text-secondary text-right break-all leading-relaxed",
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function EmbeddingDetailCard({ imageId }: EmbeddingDetailCardProps) {
  const { t } = useTranslation()
  const status = useEmbeddingStore((s) => s.getStatus(imageId))

  if (status.status === "embedded") {
    return (
      <div className="p-4 space-y-2.5">
        <SectionLabel>{t("embedding.detail.sectionLabel")}</SectionLabel>
        <div className="space-y-2">
          <InfoRow
            label={t("embedding.detail.dimensions")}
            value={String(status.dimensions ?? "1536")}
            mono
          />
          <InfoRow
            label={t("embedding.detail.model")}
            value={status.model ?? "clip-vit-base-patch32"}
          />
          <InfoRow
            label={t("embedding.detail.generated")}
            value={
              status.generatedAt
                ? new Date(status.generatedAt).toLocaleDateString()
                : "—"
            }
          />
        </div>
      </div>
    )
  }

  if (status.status === "error") {
    return (
      <div className="p-4 space-y-2.5">
        <SectionLabel>{t("embedding.detail.sectionLabel")}</SectionLabel>
        <p className="text-[12px] text-danger font-sans">
          {t("embedding.detail.failed")}
        </p>
        <button className="text-[12px] text-accent hover:text-accent-hover hover:underline transition-all duration-200 ease-out font-sans">
          {t("embedding.detail.retry")}
        </button>
      </div>
    )
  }

  // pending (default)
  return (
    <div className="p-4 space-y-2.5">
      <SectionLabel>{t("embedding.detail.sectionLabel")}</SectionLabel>
      <p className="text-[12px] text-text-muted font-sans">
        {t("embedding.detail.notGenerated")}
      </p>
    </div>
  )
}
