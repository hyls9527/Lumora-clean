import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import type { Image } from "@/lib/mock-data"
interface Command {
  id: string
  labelKey: string
  hint?: string
  section: string
  action: () => void
  _searchRecord?: Image
}

export function CommandPalette() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<Image[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    setView,
    selectAll,
    clearSelection,
    setSortBy,
    deleteImage,
    selectedIds,
    images,
    setRating,
    setDetailImage,
  } = useAppStore()

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery("")
    setFocusedIndex(0)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery("")
    setFocusedIndex(0)
  }, [])

  const rateSelected = useCallback(() => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const first = images.find((i) => i.id === ids[0])
    const next = first ? (first.rating % 5) + 1 : 1
    ids.forEach((id) => setRating(id, next))
  }, [selectedIds, images, setRating])

  const commands = useMemo<Command[]>(() => [
    { id: "nav-gallery", labelKey: "sidebar.gallery", section: "commandPalette.sections.navigation", action: () => setView("gallery") },
    { id: "nav-curation", labelKey: "sidebar.curation", section: "commandPalette.sections.navigation", action: () => setView("curation") },
    { id: "nav-dashboard", labelKey: "sidebar.dashboard", section: "commandPalette.sections.navigation", action: () => setView("dashboard") },
    { id: "nav-settings", labelKey: "sidebar.settings", section: "commandPalette.sections.navigation", action: () => setView("settings") },
    { id: "nav-trash", labelKey: "sidebar.trash", section: "commandPalette.sections.navigation", action: () => setView("trash") },
    { id: "action-new-import", labelKey: "commandPalette.commands.newImport", hint: "⌘N", section: "commandPalette.sections.import", action: () => window.dispatchEvent(new Event("open-import")) },
    { id: "action-export", labelKey: "commandPalette.commands.exportSelected", hint: "⌘E", section: "commandPalette.sections.import", action: () => window.dispatchEvent(new Event("export-selected")) },
    { id: "action-focus-search", labelKey: "commandPalette.commands.focusSearch", hint: "⌘F", section: "commandPalette.sections.actions", action: () => { closePalette(); requestAnimationFrame(() => openPalette()) } },
    { id: "action-select-all", labelKey: "commandPalette.commands.selectAll", hint: "⌘A", section: "commandPalette.sections.actions", action: () => selectAll() },
    { id: "action-clear-selection", labelKey: "commandPalette.commands.clearSelection", hint: "⌘D", section: "commandPalette.sections.actions", action: () => clearSelection() },
    { id: "action-add-tag", labelKey: "commandPalette.commands.addTagToSelected", hint: "⌘T", section: "commandPalette.sections.actions", action: () => window.dispatchEvent(new Event("add-tag-selected")) },
    { id: "action-rate-selected", labelKey: "commandPalette.commands.rateSelected", hint: "⌘R", section: "commandPalette.sections.actions", action: () => rateSelected() },
    { id: "action-delete-selected", labelKey: "commandPalette.commands.deleteSelected", section: "commandPalette.sections.actions", action: () => { selectedIds.forEach((id) => deleteImage(id)) } },
    { id: "sort-date", labelKey: "commandPalette.commands.sortByDate", section: "commandPalette.sections.sort", action: () => setSortBy("date") },
    { id: "sort-rating", labelKey: "commandPalette.commands.sortByRating", section: "commandPalette.sections.sort", action: () => setSortBy("rating") },
    { id: "sort-size", labelKey: "commandPalette.commands.sortBySize", section: "commandPalette.sections.sort", action: () => setSortBy("size") },
  ], [setView, selectAll, clearSelection, setSortBy, deleteImage, selectedIds, closePalette, rateSelected])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) => {
      const label = t(cmd.labelKey).toLowerCase()
      return label.includes(q) || cmd.id.includes(q)
    })
  }, [commands, query, t])

  const highlightMatch = useCallback((text: string) => {
    if (!query.trim()) return text
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`(${escaped})`, "gi")
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-accent/30 text-text rounded-sm px-0.5">{part}</mark> : part
    )
  }, [query])

  const hasSearchResults = query.trim() && searchResults.length > 0

  const searchResultCommands: Command[] = useMemo(() =>
    searchResults.map((r) => ({
      id: `search-${r.id}`,
      labelKey: "",
      hint: r.path.split(/[\\\\/]/).pop(),
      section: "commandPalette.sections.searchResults",
      action: () => {
        const img = images.find((i) => i.id === String(r.id))
        if (img) setDetailImage(img)
      },
      _searchRecord: r,
    })),
    [searchResults, images, setDetailImage])

  const allItems = useMemo(() =>
    hasSearchResults ? [...searchResultCommands, ...filtered] : filtered,
    [hasSearchResults, searchResultCommands, filtered])

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const cmd of allItems) {
      const list = map.get(cmd.section) || []
      list.push(cmd)
      map.set(cmd.section, list)
    }
    return map
  }, [allItems])

  const flatCommands = allItems

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => {
          if (prev) {
            setQuery("")
            setFocusedIndex(0)
            return false
          }
          setQuery("")
          setFocusedIndex(0)
          return true
        })
        return
      }

      if (open) return

      if (mod && e.key === "n") {
        e.preventDefault()
        window.dispatchEvent(new Event("open-import"))
      } else if (mod && e.key === "e") {
        e.preventDefault()
        window.dispatchEvent(new Event("export-selected"))
      } else if (mod && e.key === "f") {
        e.preventDefault()
        openPalette()
      } else if (mod && e.key === "a") {
        e.preventDefault()
        selectAll()
      } else if (mod && e.key === "d") {
        e.preventDefault()
        clearSelection()
      } else if (mod && e.key === "t") {
        e.preventDefault()
        window.dispatchEvent(new Event("add-tag-selected"))
      } else if (mod && e.key === "r") {
        e.preventDefault()
        rateSelected()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, selectAll, clearSelection, rateSelected, openPalette])

  useEffect(() => {
    const handler = () => openPalette()
    window.addEventListener("open-command-palette", handler)
    return () => window.removeEventListener("open-command-palette", handler)
  }, [openPalette])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setFocusedIndex(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      const q = query.trim().toLowerCase()
      const results = images.filter(img =>
        img.path.toLowerCase().includes(q) ||
        img.tags.some(tag => tag.toLowerCase().includes(q))
      ).slice(0, 20)
      setSearchResults(results)
      setIsSearching(false)
    }, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll("[data-command-item]")
    items[focusedIndex]?.scrollIntoView({ block: "nearest" })
  }, [focusedIndex])

  const executeCommand = useCallback((cmd: Command) => {
    closePalette()
    cmd.action()
  }, [closePalette])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, flatCommands.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (flatCommands[focusedIndex]) {
          executeCommand(flatCommands[focusedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        closePalette()
        break
    }
  }, [flatCommands, focusedIndex, executeCommand, closePalette])

  if (!open) return null

  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Dark overlay backdrop */}
      <div
        className="absolute inset-0 bg-text/35"
        onClick={closePalette}
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-[520px] bg-surface rounded-[6px] shadow-elevated border border-border overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="p-3 border-b border-border-subtle">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.placeholder")}
            className="w-full h-9 text-[14px] font-serif text-text placeholder:text-text-muted bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:shadow-none"
          />
        </div>
        {/* Command list */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {flatCommands.length === 0 ? (
            isSearching ? (
              <div className="px-4 py-6 text-center text-[13px] text-text-muted font-serif">
                {t("gallery.loading")}
              </div>
            ) : query.trim() ? (
              <div className="px-6 py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-[2px] bg-bg border border-border-subtle flex items-center justify-center mx-auto mb-1">
                  <span className="font-serif text-[18px] text-text-faint">?</span>
                </div>
                <h3 className="font-serif text-[14px] text-text">
                  {t("commandPalette.emptySearch.title")}
                </h3>
                <p className="font-serif text-[12px] text-text-muted leading-relaxed">
                  {t("commandPalette.emptySearch.subtitle")}
                </p>
                <button
                  onClick={() => { closePalette(); setView("gallery") }}
                  className="mt-2 px-4 py-1.5 rounded-[4px] font-serif text-[12px] bg-accent/8 text-accent hover:bg-accent/12 transition-all duration-200 ease-out"
                >
                  {t("commandPalette.emptySearch.action")}
                </button>
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[13px] text-text-muted font-serif">
                {t("commandPalette.noResults")}
              </div>
            )
          ) : (
            Array.from(grouped.entries()).map(([sectionKey, cmds]) => (
              <div key={sectionKey}>
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-text-faint font-sans">
                    {t(sectionKey)}
                  </span>
                </div>
                {cmds.map((cmd) => {
                  const idx = flatIndex++
                  const isFocused = idx === focusedIndex
                  const isSearch = cmd.section === "commandPalette.sections.searchResults"
                  return (
                    <button
                      key={cmd.id}
                      data-command-item
                      className={cn(
                        "w-full flex items-center px-3 py-2 rounded-[4px] text-[13px] font-serif transition-all duration-200 ease-out text-left",
                        isFocused
                          ? "bg-accent-subtle text-text"
                          : "text-text-secondary hover:bg-accent-subtle"
                      )}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => executeCommand(cmd)}
                    >
                      <span className="flex-1 truncate">
                        {isSearch ? highlightMatch(cmd._searchRecord?.path ?? "") : t(cmd.labelKey)}
                      </span>
                      {cmd.hint && (
                        <span className="text-[9px] font-serif text-text-faint opacity-60 shrink-0">
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        {/* Footer hint */}
        <div className="flex items-center gap-4 px-3 py-2 border-t border-border-subtle text-[10px] text-text-faint">
          <span className="font-serif opacity-60">
            {"↑↓"} {t("commandPalette.hints.navigate")}
          </span>
          <span className="font-serif opacity-60">
            {"⏎"} {t("commandPalette.hints.execute")}
          </span>
          <span className="font-serif opacity-60">
            Esc {t("commandPalette.hints.close")}
          </span>
        </div>
      </div>
    </div>
  )
}
