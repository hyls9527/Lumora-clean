import { useEffect, useCallback, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { ImageCard } from "@/components/ImageCard"
import { VirtualizedGrid } from "@/components/VirtualizedGrid"
import { TagFilterBar } from "@/components/TagManager"
import { ExportDialog } from "@/components/ExportDialog"
import { DropZone } from "@/components/DropZone"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"
import { BatchEmbeddingBar } from "@/components/BatchEmbeddingBar"
import { useEmbeddingStore } from "@/stores/embedding-store"
import { SemanticSearchBar } from "@/components/SemanticSearchBar"
import { useSemanticSearchStore } from "@/stores/semantic-search-store"

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
    toggleFavorite,
    deleteFocusedImage,
    openFocusedImage,
    images,
  } = useAppStore()

  const isGenerating = useEmbeddingStore((s) => s.isGenerating)

  // Semantic search store selectors
  const searchMode = useSemanticSearchStore((s) => s.searchMode)
  const semanticResults = useSemanticSearchStore((s) => s.results)
  const semanticQuery = useSemanticSearchStore((s) => s.query)
  const semanticError = useSemanticSearchStore((s) => s.error)
  const isSearching = useSemanticSearchStore((s) => s.isSearching)
  const setSearchMode = useSemanticSearchStore((s) => s.setSearchMode)

  const exactFilteredImages = getFilteredImages()

  const semanticFilteredImages = (() => {
    if (searchMode !== 'semantic' || semanticResults.length === 0) {
      // When no semantic results, fall back to exact filtering
      // (but only if there's a query — otherwise show all)
      if (semanticQuery.length > 0) return []
      return exactFilteredImages
    }
    // Build a map of imageId -> score for fast lookup
    const scoreMap = new Map(semanticResults.map(r => [r.imageId, r.score]))
    // Filter images to only those in semantic results, sorted by score DESC
    return exactFilteredImages
      .filter(img => scoreMap.has(img.id))
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
  })()

  // Use semanticFilteredImages as the display list
  const displayImages = searchMode === 'semantic' && semanticQuery.length > 0
    ? semanticFilteredImages
    : exactFilteredImages

  const useVirtualized = displayImages.length >= VIRTUALIZE_THRESHOLD

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [exportOpen, setExportOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() =>
    !localStorage.getItem('lumora-onboarded')
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

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
        const avgRatio = displayImages.reduce((sum, img) => sum + parseAspectRatio(img.aspectRatio), 0) / displayImages.length
        return Math.floor(virtualizedColumnWidth / avgRatio) + GAP
      })()
    : 0

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === "INPUT" || target.closest("[data-slot='dialog-content']")) return

    const len = displayImages.length
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
        if (focusedIndex >= 0 && !isGenerating) {
          e.preventDefault()
          const img = displayImages[focusedIndex]
          if (img) toggleSelect(img.id)
        }
        break
      case "f":
      case "F":
        if (focusedIndex >= 0) {
          e.preventDefault()
          const img = displayImages[focusedIndex]
          if (img) toggleFavorite(img.id)
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
        // If semantic search is active and has a query, clear search first
        if (searchMode === 'semantic' && semanticQuery.length > 0) {
          useSemanticSearchStore.getState().clearSearch()
          return
        }
        clearSelection()
        setFocusedIndex(-1)
        break
    }

    // Detect ⌘⇧K / Ctrl+Shift+K — outside switch to avoid fallthrough
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
      e.preventDefault()
      setSearchMode('semantic')
      // Focus the SemanticSearchBar input via a custom event
      window.dispatchEvent(new CustomEvent('focus-semantic-search'))
      return
    }
  }, [displayImages, focusedIndex, setFocusedIndex, toggleSelect, toggleFavorite, deleteFocusedImage, openFocusedImage, clearSelection, isGenerating, searchMode, semanticQuery, setSearchMode])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (focusedIndex >= displayImages.length && displayImages.length > 0) {
      setFocusedIndex(displayImages.length - 1)
    }
  }, [displayImages.length, focusedIndex, setFocusedIndex])

  useEffect(() => {
    const handler = () => setExportOpen(true)
    window.addEventListener("export-selected", handler)
    return () => window.removeEventListener("export-selected", handler)
  }, [])

  const { isLoading } = useAppStore()

  return (
    <PageErrorBoundary>
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
              onClick={() => {
                if (sortBy === s) {
                  setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy(s)
                  setSortDirection('desc')
                }
              }}
              className={cn(
                "px-2 pb-2.5 mb-[-1px] font-serif text-[11px] border-b-2 transition-all duration-200 ease-out",
                sortBy === s
                  ? "border-accent text-text font-semibold"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              )}
            >
              {t(`gallery.sort.${s}`)}{sortBy === s && <span className="ml-1 text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <>
              <span className="font-serif text-[11px] text-accent-hover">
                {selectedIds.size} {t("gallery.selected")}
              </span>
              <button
                onClick={() => setExportOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-serif text-[11px] text-text-secondary hover:bg-accent-subtle hover:text-accent transition-all duration-200 ease-out"
              >
                {t("toolbar.export")}
              </button>
            </>
          )}

          <button
            onClick={selectAll}
            className="font-serif text-[11px] text-text-faint hover:text-text-muted transition-all duration-200 ease-out"
          >
            {t("toolbar.selectAll")}
          </button>

          <button
            className="font-serif text-[11px] text-text-faint hover:text-text-muted transition-all duration-200 ease-out"
          >
            {t("toolbar.listView")}
          </button>
        </div>
      </div>

      {/* Batch embedding bar — appears when images are selected */}
      <BatchEmbeddingBar
        selectedIds={selectedIds}
        onGenerationStart={() => {
          // Selection is locked during generation — the batch bar handles visual state
        }}
        onGenerationEnd={() => {
          // Re-enable selection interaction. The store's isGenerating flag drives the lock.
        }}
      />

      {/* Semantic search bar — Phase 005 */}
      <div className="px-10 py-3 border-b border-border-subtle shrink-0">
        <SemanticSearchBar />
      </div>

      {/* Tag filter bar */}
      <div className="px-10 py-2 border-b border-border-subtle shrink-0">
        <TagFilterBar />
      </div>

      {/* Onboarding hint (first visit) */}
      {images.length > 0 && showOnboarding && (
        <div className="px-10 py-3 bg-accent/5 border-b border-accent/10 transition-all duration-200 ease-out">
          <p className="font-serif text-[12px] text-text-muted text-center">
            按 <kbd className="px-1.5 py-0.5 rounded bg-bg border border-border-subtle text-[10px]">⌘K</kbd> 打开命令面板 ·
            点击图片查看详情 ·
            悬停显示评分和收藏
          </p>
          <button
            className="block mx-auto mt-2 text-[10px] text-accent hover:underline transition-all duration-200 ease-out"
            onClick={() => {
              localStorage.setItem('lumora-onboarded', 'true')
              setShowOnboarding(false)
            }}
          >
            知道了
          </button>
        </div>
      )}

      {/* Semantic results count */}
      {searchMode === 'semantic' && semanticQuery.length > 0 && semanticResults.length > 0 && !isSearching && (
        <div className="px-10 py-1.5">
          <span className="font-sans text-[12px] text-text-muted">
            {t("semanticSearch.results.count").replace("{n}", String(semanticResults.length))}
          </span>
        </div>
      )}

      {/* Image masonry */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-serif text-[15px] text-text-muted animate-pulse">
              {t("loading.grinding")}
            </p>
          </div>
        ) : isSearching && searchMode === 'semantic' ? (
          <div className="columns-4 gap-x-4 gap-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4">
                <div className="rounded-[2px] bg-surface animate-pulse" style={{ aspectRatio: '1/1' }} />
              </div>
            ))}
          </div>
        ) : displayImages.length === 0 ? (
          <>
            {/* Semantic search empty state: query entered, no results */}
            {searchMode === 'semantic' && semanticQuery.length > 0 && !isSearching ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-[2px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-4">
                    <span className="font-serif text-[24px] text-text-faint">♢</span>
                  </div>
                  <h3 className="font-serif text-[18px] text-text mb-1">
                    {t("semanticSearch.empty.heading")}
                  </h3>
                  <p className="font-sans text-[14px] text-text-muted mb-4 max-w-sm leading-relaxed">
                    {t("semanticSearch.empty.body")}
                  </p>
                  <button
                    onClick={() => {
                      useSemanticSearchStore.getState().clearSearch()
                      useSemanticSearchStore.getState().setSearchMode('exact')
                    }}
                    className="font-serif text-[12px] text-accent hover:underline transition-all duration-200 ease-out"
                  >
                    {t("semanticSearch.empty.action")}
                  </button>
                  {/* No embeddings note — shown when embeddedCount === 0 */}
                  {useEmbeddingStore.getState().embeddedCount() === 0 && (
                    <p className="font-sans text-[10px] text-text-faint mt-3">
                      {t("semanticSearch.empty.noEmbeddingsNote")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Original empty state (no images at all) */
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-[2px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-4">
                    <span className="font-serif text-[20px] text-text-faint">◆</span>
                  </div>
                  <h3 className="font-serif text-[16px] text-text-muted mb-1">
                    {t("gallery.empty.title")}
                  </h3>
                  <p className="font-serif text-[13px] text-text-faint mb-4">
                    {t("gallery.empty.subtitle")}
                  </p>
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-import"))}
                    className="px-4 py-2 rounded-[4px] font-serif text-[12px] bg-accent text-surface hover:bg-accent-hover transition-all duration-200 ease-out"
                  >
                    导入图片
                  </button>
                </div>
              </div>
            )}
          </>
        ) : useVirtualized && containerSize.width > 0 ? (
          <VirtualizedGrid
            images={displayImages}
            columns={COLS}
            columnWidth={virtualizedColumnWidth}
            rowHeight={virtualizedRowHeight}
            height={containerSize.height}
            width={containerSize.width}
            focusedIndex={focusedIndex}
          />
        ) : (
          <div className="columns-4 gap-x-4 gap-y-4">
            {displayImages.map((image, index) => (
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

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <DropZone />
    </div>
    </PageErrorBoundary>
  )
}
