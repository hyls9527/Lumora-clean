import { useEffect, useCallback, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { ImageCard } from "@/components/ImageCard"
import { VirtualizedGrid } from "@/components/VirtualizedGrid"
import { TagFilterBar } from "@/components/TagManager"

const VIRTUALIZE_THRESHOLD = 100
const COLS = 4
const GAP = 16

function parseAspectRatio(ar: string): number {
  const [w, h] = ar.split("/").map(Number)
  return w / h
}

export function GalleryPage() {
  const { t } = useTranslation()
  const {
    sortBy,
    setSortBy,
    selectedIds,
    clearSelection,
    selectAll,
    focusedIndex,
    setFocusedIndex,
    getFilteredImages,
    toggleSelect,
    deleteFocusedImage,
    openFocusedImage,
  } = useAppStore()

  const filteredImages = getFilteredImages()
  const useVirtualized = filteredImages.length >= VIRTUALIZE_THRESHOLD

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!useVirtualized || !containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [useVirtualized])

  const virtualizedColumnWidth = useVirtualized && containerSize.width > 0
    ? Math.floor((containerSize.width - GAP * (COLS - 1)) / COLS)
    : 0

  const virtualizedRowHeight = useVirtualized
    ? (() => {
        const avgRatio = filteredImages.reduce((sum, img) => sum + parseAspectRatio(img.aspectRatio), 0) / filteredImages.length
        return Math.floor(virtualizedColumnWidth / avgRatio) + GAP
      })()
    : 0

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === "INPUT" || target.closest("[data-slot='dialog-content']")) return

    const len = filteredImages.length
    if (len === 0) return

    const cols = 4

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault()
        setFocusedIndex(Math.min(focusedIndex + 1, len - 1))
        break
      case "ArrowLeft":
        e.preventDefault()
        setFocusedIndex(Math.max(focusedIndex - 1, 0))
        break
      case "ArrowDown":
        e.preventDefault()
        setFocusedIndex(Math.min(focusedIndex + cols, len - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setFocusedIndex(Math.max(focusedIndex - cols, 0))
        break
      case "Enter":
        if (focusedIndex >= 0) {
          e.preventDefault()
          openFocusedImage()
        }
        break
      case " ":
        if (focusedIndex >= 0) {
          e.preventDefault()
          const img = filteredImages[focusedIndex]
          if (img) toggleSelect(img.id)
        }
        break
      case "Delete":
      case "Backspace":
        if (focusedIndex >= 0 && target.tagName !== "INPUT") {
          e.preventDefault()
          deleteFocusedImage()
        }
        break
      case "Escape":
        e.preventDefault()
        clearSelection()
        setFocusedIndex(-1)
        break
    }
  }, [filteredImages, focusedIndex, setFocusedIndex, toggleSelect, deleteFocusedImage, openFocusedImage, clearSelection])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (focusedIndex >= filteredImages.length && filteredImages.length > 0) {
      setFocusedIndex(filteredImages.length - 1)
    }
  }, [filteredImages.length, focusedIndex, setFocusedIndex])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Section heading */}
      <div className="px-10 pt-6 pb-0">
        <h2 className="font-serif text-[11px] font-normal uppercase tracking-[0.18em] text-text-muted pb-3 border-b border-border mb-6">
          {t("gallery.heading")}
        </h2>
      </div>

      {/* Toolbar */}
      <div className="h-11 px-10 flex items-center justify-between bg-surface border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-1">
          {(["date", "rating", "size"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "px-2 pb-2.5 mb-[-1px] font-serif text-[11px] border-b-2 transition-colors",
                sortBy === s
                  ? "border-accent text-text font-semibold"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              )}
            >
              {t(`gallery.sort.${s}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <span className="font-serif text-[11px] text-accent-hover">
              {selectedIds.size} {t("gallery.selected")}
            </span>
          )}

          <button
            onClick={selectAll}
            className="font-serif text-[11px] text-text-faint hover:text-text-muted transition-colors"
          >
            {t("toolbar.selectAll")}
          </button>

          <button
            className="font-serif text-[11px] text-text-faint hover:text-text-muted transition-colors"
          >
            {t("toolbar.listView")}
          </button>
        </div>
      </div>

      {/* Tag filter bar */}
      <div className="px-10 py-2 border-b border-border-subtle shrink-0">
        <TagFilterBar />
      </div>

      {/* Image masonry */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-10">
        {filteredImages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="font-serif text-[16px] text-text-muted mb-1">
                {t("gallery.empty.title")}
              </h3>
              <p className="font-serif text-[13px] text-text-faint">
                {t("gallery.empty.subtitle")}
              </p>
            </div>
          </div>
        ) : useVirtualized && containerSize.width > 0 ? (
          <VirtualizedGrid
            images={filteredImages}
            columns={COLS}
            columnWidth={virtualizedColumnWidth}
            rowHeight={virtualizedRowHeight}
            height={containerSize.height}
            width={containerSize.width}
            focusedIndex={focusedIndex}
          />
        ) : (
          <div className="columns-4 gap-x-4 gap-y-4">
            {filteredImages.map((image, index) => (
              <div key={image.id} className="break-inside-avoid mb-4">
                <ImageCard image={image} focused={index === focusedIndex} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section divider */}
      <div className="flex items-center gap-4 my-12 px-10">
        <div className="flex-1 h-px" style={{ backgroundImage: "repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 4px, transparent 4px, transparent 8px)" }} />
        <span className="font-serif text-[10px] uppercase tracking-[0.16em] text-text-faint">
          {t("gallery.divider")}
        </span>
        <div className="flex-1 h-px" style={{ backgroundImage: "repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 4px, transparent 4px, transparent 8px)" }} />
      </div>
    </div>
  )
}
