import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { ImageCard } from "@/components/ImageCard"
import {
  Grid3X3,
  LayoutGrid,
  CheckSquare,
  X,
  Image,
} from "lucide-react"

export function GalleryPage() {
  const { t } = useTranslation()
  const {
    images,
    searchQuery,
    sortBy,
    setSortBy,
    selectedIds,
    clearSelection,
    selectAll,
  } = useAppStore()

  const filteredImages = images.filter((img) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      img.tags.some((tag) => tag.includes(q)) ||
      img.path.toLowerCase().includes(q) ||
      img.analysis?.generation?.prompt?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Toolbar — elevated with border-bottom + bg-surface */}
      <div className="h-11 px-5 flex items-center justify-between bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {(["date", "rating", "size"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "px-3 py-1 rounded-[6px] text-[12px] transition-colors",
                sortBy === s
                  ? "bg-text text-surface font-medium"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-hover"
              )}
            >
              {t(`gallery.sort.${s}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle">
              <span className="text-[11px] font-medium text-accent-hover">
                {selectedIds.size} {t("gallery.selected")}
              </span>
              <button
                onClick={clearSelection}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-accent/15 transition-colors"
              >
                <X className="w-2.5 h-2.5 text-accent-hover" />
              </button>
            </div>
          )}

          <button
            onClick={selectAll}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center hover:bg-surface-hover transition-colors"
            title={t("gallery.selectAll")}
          >
            <CheckSquare className="w-3.5 h-3.5 text-text-muted" />
          </button>

          <div className="flex items-center gap-px bg-bg rounded-[6px] p-0.5 border border-border-subtle">
            <button className="w-6 h-6 rounded-[4px] flex items-center justify-center bg-surface shadow-xs text-text">
              <Grid3X3 className="w-3 h-3" />
            </button>
            <button className="w-6 h-6 rounded-[4px] flex items-center justify-center text-text-muted hover:text-text-secondary">
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {filteredImages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-[14px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-4">
                <Image className="w-8 h-8 text-text-faint" />
              </div>
              <h3 className="text-[14px] font-medium text-text-secondary mb-1">
                {t("gallery.empty.title")}
              </h3>
              <p className="text-[12px] text-text-muted">
                {t("gallery.empty.subtitle")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {filteredImages.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
