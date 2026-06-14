import { useAppStore } from "@/stores/app-store"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  X,
  Star,
  Heart,
  Copy,
  Trash2,
  Tag,
  Maximize2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

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
          className="w-7 h-7 rounded-[6px] flex items-center justify-center hover:bg-surface-hover transition-colors"
        >
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {/* Image preview */}
        <div className="p-4">
          <div className="relative rounded-[10px] overflow-hidden group shadow-sm">
            <img
              src={image.thumbnail}
              alt=""
              className="w-full object-cover"
            />
            <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/30 text-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <Maximize2 className="w-3.5 h-3.5" />
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
                <Star
                  className={cn(
                    "w-4 h-4 transition-colors duration-100",
                    star <= image.rating
                      ? "text-accent fill-accent"
                      : "text-text-faint hover:text-text-muted"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border-subtle" />
          <button
            onClick={() => toggleFavorite(image.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-100",
              image.favorite
                ? "bg-accent-subtle text-accent-hover"
                : "text-text-muted hover:bg-surface-hover"
            )}
          >
            <Heart
              className={cn("w-3 h-3", image.favorite && "fill-current")}
            />
            {image.favorite ? t("detail.favorited") : t("detail.favorite")}
          </button>
        </div>

        <div className="mx-4 h-px bg-border-subtle" />

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

        <div className="mx-4 h-px bg-border-subtle" />

        {/* Tags */}
        <div className="p-4 space-y-2.5">
          <SectionLabel>{t("detail.tags")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {image.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="rounded-[6px] text-[11px] px-2 py-0.5 font-medium"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Analysis */}
        {image.analysis && (
          <>
            <div className="mx-4 h-px bg-border-subtle" />
            <div className="p-4 space-y-2.5">
              <SectionLabel>{t("detail.analysis")}</SectionLabel>
              {image.analysis.generation?.prompt && (
                <div className="space-y-1">
                  <span className="text-[10px] text-text-faint font-medium uppercase tracking-[0.06em]">Prompt</span>
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
            <div className="mx-4 h-px bg-border-subtle" />
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
          <div className="mx-0 h-px bg-border-subtle mb-2" />
          <ActionButton icon={Copy} label={t("detail.copyPath")} />
          <ActionButton icon={Tag} label={t("detail.addTag")} />
          <ActionButton
            icon={Trash2}
            label={t("detail.delete")}
            variant="danger"
          />
        </div>
      </ScrollArea>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-medium uppercase tracking-[0.06em] text-text-faint">
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
      <div className="flex-1 h-1.5 rounded-full bg-bg overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
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
  icon: Icon,
  label,
  variant,
}: {
  icon: React.ElementType
  label: string
  variant?: "danger"
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[12px] transition-colors duration-100",
        variant === "danger"
          ? "text-danger hover:bg-danger/5"
          : "text-text-secondary hover:bg-surface-hover"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  )
}
