import { useState, useRef, useEffect } from "react"
import { useTranslation } from "@/lib/i18n"
import { useSemanticSearchStore } from "@/stores/semantic-search-store"
import { useEmbeddingStore } from "@/stores/embedding-store"
import { cn } from "@/lib/utils"

interface SemanticSearchBarProps {
  className?: string
}

export function SemanticSearchBar({ className }: SemanticSearchBarProps) {
  const { t } = useTranslation()

  const query = useSemanticSearchStore((s) => s.query)
  const searchMode = useSemanticSearchStore((s) => s.searchMode)
  const suggestions = useSemanticSearchStore((s) => s.suggestions)
  const tryDescribing = useSemanticSearchStore((s) => s.tryDescribing)
  const isSearching = useSemanticSearchStore((s) => s.isSearching)
  const isLoadingSuggestions = useSemanticSearchStore((s) => s.isLoadingSuggestions)
  const error = useSemanticSearchStore((s) => s.error)
  const setQuery = useSemanticSearchStore((s) => s.setQuery)
  const setSearchMode = useSemanticSearchStore((s) => s.setSearchMode)
  const search = useSemanticSearchStore((s) => s.search)
  const loadSuggestions = useSemanticSearchStore((s) => s.loadSuggestions)
  const clearSearch = useSemanticSearchStore((s) => s.clearSearch)

  const embeddedCount = useEmbeddingStore((s) => s.embeddedCount())

  const inputRef = useRef<HTMLInputElement>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search: 300ms delay when query >= 2 chars and semantic mode
  useEffect(() => {
    if (searchMode !== "semantic") return

    if (query.length < 2) {
      // Clear results when query is too short (don't clear query text)
      search("")
      return
    }

    const timer = setTimeout(() => {
      search(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchMode])

  // Load suggestions: no debounce, fast mock response
  useEffect(() => {
    if (searchMode !== "semantic") return

    if (query.length >= 2) {
      loadSuggestions(query)
    }
  }, [query, searchMode])

  // Cleanup dismiss timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current)
    }
  }, [])

  // Listen for external focus event (from GalleryPage keyboard shortcut)
  useEffect(() => {
    const handler = () => {
      inputRef.current?.focus()
    }
    window.addEventListener('focus-semantic-search', handler)
    return () => window.removeEventListener('focus-semantic-search', handler)
  }, [])

  const handleFocus = () => setShowDropdown(true)

  const handleBlur = () => {
    dismissTimeoutRef.current = setTimeout(() => setShowDropdown(false), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      clearSearch()
      inputRef.current?.blur()
    } else if (e.key === "Enter") {
      search(query)
    }
  }

  const handleClear = () => {
    clearSearch()
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (value: string) => {
    setQuery(value)
    search(value)
    setShowDropdown(false)
  }

  const dropdownVisible =
    showDropdown &&
    query.length >= 2 &&
    searchMode === "semantic" &&
    (suggestions.length > 0 || tryDescribing.length > 0 || isLoadingSuggestions)

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-1">
        {/* Search Input Container — relative for dropdown positioning */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={t("semanticSearch.placeholder")}
            className={cn(
              "h-9 w-full rounded-[4px] border border-border bg-surface",
              "pl-3 pr-16",
              "font-serif text-[14px] text-text",
              "placeholder:text-text-muted",
              "focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none",
              "transition-all duration-200 ease-out",
            )}
          />

          {/* Searching indicator */}
          {isSearching && (
            <span className="absolute right-10 top-1/2 -translate-y-1/2 font-sans text-[12px] text-text-muted pointer-events-none animate-in fade-in duration-200">
              {t("semanticSearch.searching")}
            </span>
          )}

          {/* Clear button */}
          {query.length > 0 && (
            <button
              onClick={handleClear}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2",
                "font-sans text-[12px] text-text-muted hover:text-text-secondary",
                "transition-colors duration-200",
              )}
            >
              {t("semanticSearch.clear")}
            </button>
          )}

          {/* Autocomplete Dropdown — inside input container for correct width */}
          {dropdownVisible && (
            <div
              className={cn(
                "absolute left-0 right-0 mt-1 max-h-[240px] overflow-y-auto z-40",
                "bg-surface border border-border rounded-[6px] shadow-elevated",
              )}
            >
              {isLoadingSuggestions ? (
                <div className="px-3 py-4 font-sans text-[12px] text-text-faint text-center">
                  {t("semanticSearch.searching")}
                </div>
              ) : (
                <>
                  {/* SUGGESTIONS section */}
                  {suggestions.length > 0 && (
                    <>
                      <div className="font-sans text-[10px] font-medium uppercase tracking-[0.1em] text-text-faint px-3 pt-2 pb-1">
                        {t("semanticSearch.suggestions.heading")}
                      </div>
                      {suggestions.map((item) => (
                        <button
                          key={item}
                          onMouseDown={(e) => {
                            // Prevent blur from firing before click
                            e.preventDefault()
                            handleSuggestionClick(item)
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5",
                            "font-sans text-[12px] text-text-secondary",
                            "hover:bg-accent-subtle hover:text-text",
                            "rounded-[4px] cursor-pointer",
                            "transition-all duration-200 ease-out",
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Divider */}
                  {suggestions.length > 0 && tryDescribing.length > 0 && (
                    <div className="border-t border-border-subtle mx-2 my-1" />
                  )}

                  {/* TRY DESCRIBING section */}
                  {tryDescribing.length > 0 && (
                    <>
                      <div className="font-sans text-[10px] font-medium uppercase tracking-[0.1em] text-text-faint px-3 pt-2 pb-1">
                        {t("semanticSearch.suggestions.tryDescribing")}
                      </div>
                      {tryDescribing.map((item) => (
                        <button
                          key={item}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSuggestionClick(item)
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5",
                            "font-sans text-[12px] text-text-secondary",
                            "hover:bg-accent-subtle hover:text-text",
                            "rounded-[4px] cursor-pointer",
                            "transition-all duration-200 ease-out",
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center shrink-0 ml-3">
          {(["exact", "semantic"] as const).map((mode) => (
            <div key={mode} className="flex flex-col items-center">
              <button
                onClick={() => setSearchMode(mode)}
                className={cn(
                  "px-2 pb-2.5 mb-[-1px] font-serif text-[12px] border-b-2 transition-all duration-200 ease-out",
                  searchMode === mode
                    ? "border-accent text-text font-semibold"
                    : "border-transparent text-text-muted hover:text-text-secondary",
                )}
              >
                {t(`semanticSearch.mode.${mode}`)}
              </button>
              <span className="font-sans text-[10px] text-text-faint mt-0.5">
                {t(`semanticSearch.mode.${mode}Hint`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-2 text-center">
          <p className="font-sans text-[14px] text-danger">
            {t("semanticSearch.error.unavailable")}
          </p>
          <button
            onClick={() => setSearchMode("exact")}
            className="font-serif text-[12px] text-accent hover:underline mx-auto mt-1 block"
          >
            {t("semanticSearch.error.switchToExact")}
          </button>
        </div>
      )}

      {/* No Embeddings Note */}
      {searchMode === "semantic" && embeddedCount === 0 && !error && (
        <p className="font-sans text-[10px] text-text-faint mt-1 ml-1">
          {t("semanticSearch.empty.noEmbeddingsNote")}
        </p>
      )}
    </div>
  )
}
