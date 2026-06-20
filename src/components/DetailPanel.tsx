import { useAppStore } from "@/stores/app-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { PlumFlower } from "@/components/ui/plum-flower"

export function DetailPanel() {
  const { t } = useTranslation()
  const { detailImage, setDetailImage, toggleFavorite, setRating } = useAppStore()

  if (!detailImage) return null

  const image = detailImage

  return (
    <div className="w-[320px] h-screen border-l border-border-subtle bg-surface flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <span className="text-[13px] font-semibold tracking-[-0.01em]">{t("detail.title")}</span>
        <button
          onClick={() => setDetailImage(null)}
          className="w-7 h-7 rounded-[4px] flex items-center justify-center hover:bg-surface-hover transition-all duration-200 ease-out"
        >
          <span className="text-[12px] text-text-muted">关闭</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image preview */}
        <div className="p-4">
          <div className="relative rounded-[2px] overflow-hidden group shadow-card">
            <img
              src={image.thumbnail}
              alt={`Detail view: ${detailImage?.format || "image"}`}
              className="w-full object-cover"
            />
            <button aria-label="关闭详情" className="absolute top-2 right-2 w-7 h-7 rounded-[4px] bg-text/30 text-surface/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out">
              <span className="text-[11px]">全屏</span>
            </button>
          </div>
        </div>

        {/* Rating & Favorite */}
        <div className="px-4 pb-4 flex items-center gap-3">
          <div className="flex items-center gap-px">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(image.id, image.rating === star ? 0 : star)}
                className="w-7 h-7 flex items-center justify-center"
              >
                <PlumFlower filled={star <= image.rating} size={18} />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border-subtle" />
          <button
            onClick={() => toggleFavorite(image.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] font-medium transition-all duration-200 ease-out",
              image.favorite
                ? "bg-accent-subtle text-accent-hover"
                : "text-text-muted hover:bg-surface-hover"
            )}
          >
            <span className={cn("text-[11px]", image.favorite ? "text-accent" : "text-text-faint")}>◆</span>
            {image.favorite ? t("detail.favorited") : t("detail.favorite")}
          </button>
        </div>

        <div className="h-px bg-border-subtle mx-4" />

        {/* File info */}
        <div className="p-4 space-y-2.5">
          <SectionLabel>{t("detail.fileInfo")}</SectionLabel>
          <div className="space-y-2">
            <InfoRow label={t("detail.path")} value={image.path} mono />
            <InfoRow
              label={t("detail.dimensions")}
              value={`${image.width} × ${image.height}`}
              mono
            />
            <InfoRow
              label={t("detail.size")}
              value={`${(image.sizeKb / 1024).toFixed(1)} MB`}
              mono
            />
            <InfoRow label={t("detail.format")} value={image.format.toUpperCase()} />
            <InfoRow
              label={t("detail.created")}
              value={new Date(image.createdAt).toLocaleDateString()}
            />
          </div>
        </div>

        <div className="h-px bg-border-subtle mx-4" />

        {/* Tags */}
        <div className="p-4 space-y-2.5">
          <SectionLabel>{t("detail.tags")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {image.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="rounded-[4px] text-[11px] px-2 py-0.5 font-medium"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Analysis */}
        {image.analysis && (
          <>
            <div className="h-px bg-border-subtle mx-4" />
            <div className="p-4 space-y-2.5">
              <SectionLabel>{t("detail.analysis")}</SectionLabel>
              {image.analysis.generation?.prompt && (
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-[0.1em] text-text-faint font-sans">Prompt</span>
                  <p className="text-[12px] text-text-secondary leading-[1.6]">
                    {image.analysis.generation.prompt}
                  </p>
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                {image.analysis.generation?.model && (
                  <InfoRow label="Model" value={image.analysis.generation.model} />
                )}
                {image.analysis.generation?.sampler && (
                  <InfoRow label="Sampler" value={image.analysis.generation.sampler} />
                )}
                {image.analysis.generation?.steps && (
                  <InfoRow label="Steps" value={String(image.analysis.generation.steps)} mono />
                )}
                {image.analysis.generation?.cfg_scale && (
                  <InfoRow label="CFG" value={String(image.analysis.generation.cfg_scale)} mono />
                )}
              </div>
            </div>
          </>
        )}

        {/* Score */}
        {image.score && (
          <>
            <div className="h-px bg-border-subtle mx-4" />
            <div className="p-4 space-y-2.5">
              <SectionLabel>{t("detail.score")}</SectionLabel>
              <div className="space-y-2">
                {Object.entries(image.score).map(([key, value]) => (
                  <ScoreBar key={key} label={key} value={value} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="p-4 pt-2 space-y-px">
          <div className="h-px bg-border-subtle mx-0 mb-2" />
          <ActionButton label="复制路径" description={t("detail.copyPath")} />
          <ActionButton label="标签" description={t("detail.addTag")} />
          <ActionButton
            label="删除"
            description={t("detail.delete")}
            variant="danger"
          />
        </div>
      </div>
    </div>
  )
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
          mono && "font-mono text-[11px]"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] text-text-faint capitalize w-16 shrink-0 font-medium">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-[2px] bg-bg overflow-hidden">
        <div
          className="h-full rounded-[2px] bg-accent transition-all duration-200 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-muted w-6 text-right tabular-nums">
        {value}
      </span>
    </div>
  )
}

function ActionButton({
  label,
  description,
  variant,
}: {
  label: string
  description: string
  variant?: "danger"
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] text-[12px] transition-all duration-200 ease-out",
        variant === "danger"
          ? "text-danger hover:bg-danger/5"
          : "text-text-secondary hover:bg-surface-hover"
      )}
    >
      <span className="text-[12px] w-[18px] text-center shrink-0">{label}</span>
      <span>{description}</span>
    </button>
  )
}
