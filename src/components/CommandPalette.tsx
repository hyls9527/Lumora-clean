import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import type { Image as MockImage } from "@/lib/mock-data"
import {
  Image,
  Sparkles,
  BarChart3,
  Settings,
  Trash2,
  CheckSquare,
  X,
  ArrowDownAZ,
  ArrowUpAZ,
  HardDrive,
  FolderPlus,
  Download,
  Search,
  Tag,
  Star,
} from "lucide-react"

interface Command {
  id: string
  labelKey: string
  hint?: string
  icon: React.ElementType
  section: string
  action: () => void
  _searchRecord?: MockImage
}

export function CommandPalette() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<MockImage[]>([])
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
    { id: "nav-gallery", labelKey: "sidebar.gallery", icon: Image, section: "commandPalette.sections.navigation", action: () => setView("gallery") },
    { id: "nav-curation", labelKey: "sidebar.curation", icon: Sparkles, section: "commandPalette.sections.navigation", action: () => setView("curation") },
    { id: "nav-dashboard", labelKey: "sidebar.dashboard", icon: BarChart3, section: "commandPalette.sections.navigation", action: () => setView("dashboard") },
    { id: "nav-settings", labelKey: "sidebar.settings", icon: Settings, section: "commandPalette.sections.navigation", action: () => setView("settings") },
    { id: "nav-trash", labelKey: "sidebar.trash", icon: Trash2, section: "commandPalette.sections.navigation", action: () => setView("trash") },
    { id: "action-new-import", labelKey: "commandPalette.commands.newImport", hint: "⌘N", icon: FolderPlus, section: "commandPalette.sections.import", action: () => window.dispatchEvent(new Event("open-import")) },
    { id: "action-export", labelKey: "commandPalette.commands.exportSelected", hint: "⌘E", icon: Download, section: "commandPalette.sections.import", action: () => window.dispatchEvent(new Event("export-selected")) },
    { id: "action-focus-search", labelKey: "commandPalette.commands.focusSearch", hint: "⌘F", icon: Search, section: "commandPalette.sections.actions", action: () => { closePalette(); requestAnimationFrame(() => openPalette()) } },
    { id: "action-select-all", labelKey: "commandPalette.commands.selectAll", hint: "⌘A", icon: CheckSquare, section: "commandPalette.sections.actions", action: () => selectAll() },
    { id: "action-clear-selection", labelKey: "commandPalette.commands.clearSelection", hint: "⌘D", icon: X, section: "commandPalette.sections.actions", action: () => clearSelection() },
    { id: "action-add-tag", labelKey: "commandPalette.commands.addTagToSelected", hint: "⌘T", icon: Tag, section: "commandPalette.sections.actions", action: () => window.dispatchEvent(new Event("add-tag-selected")) },
    { id: "action-rate-selected", labelKey: "commandPalette.commands.rateSelected", hint: "⌘R", icon: Star, section: "commandPalette.sections.actions", action: () => rateSelected() },
    { id: "action-delete-selected", labelKey: "commandPalette.commands.deleteSelected", icon: Trash2, section: "commandPalette.sections.actions", action: () => { selectedIds.forEach((id) => deleteImage(id)) } },
    { id: "sort-date", labelKey: "commandPalette.commands.sortByDate", icon: ArrowDownAZ, section: "commandPalette.sections.sort", action: () => setSortBy("date") },
    { id: "sort-rating", labelKey: "commandPalette.commands.sortByRating", icon: ArrowUpAZ, section: "commandPalette.sections.sort", action: () => setSortBy("rating") },
    { id: "sort-size", labelKey: "commandPalette.commands.sortBySize", icon: HardDrive, section: "commandPalette.sections.sort", action: () => setSortBy("size") },
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
      icon: Image,
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
            <div className="px-4 py-6 text-center text-[13px] text-text-muted font-serif">
              {isSearching ? t("gallery.loading") : t("commandPalette.noResults")}
            </div>
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
                  const Icon = cmd.icon
                  const isFocused = idx === focusedIndex
                  const isSearch = cmd.section === "commandPalette.sections.searchResults"
                  return (
                    <button
                      key={cmd.id}
                      data-command-item
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] text-[13px] font-serif transition-all duration-200 ease-out text-left",
                        isFocused
                          ? "bg-accent-subtle text-text"
                          : "text-text-secondary hover:bg-accent-subtle"
                      )}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => executeCommand(cmd)}
                    >
                      <Icon className="w-4 h-4 shrink-0 opacity-50" />
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
