import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
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
} from "lucide-react"

interface Command {
  id: string
  labelKey: string
  hint?: string
  icon: React.ElementType
  section: string
  action: () => void
}

export function CommandPalette() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const {
    setView,
    selectAll,
    clearSelection,
    setSortBy,
    deleteImage,
    selectedIds,
  } = useAppStore()

  const commands = useMemo<Command[]>(() => [
    { id: "nav-gallery", labelKey: "sidebar.gallery", icon: Image, section: "commandPalette.sections.navigation", action: () => setView("gallery") },
    { id: "nav-curation", labelKey: "sidebar.curation", icon: Sparkles, section: "commandPalette.sections.navigation", action: () => setView("curation") },
    { id: "nav-dashboard", labelKey: "sidebar.dashboard", icon: BarChart3, section: "commandPalette.sections.navigation", action: () => setView("dashboard") },
    { id: "nav-settings", labelKey: "sidebar.settings", icon: Settings, section: "commandPalette.sections.navigation", action: () => setView("settings") },
    { id: "nav-trash", labelKey: "sidebar.trash", icon: Trash2, section: "commandPalette.sections.navigation", action: () => setView("trash") },
    { id: "action-select-all", labelKey: "commandPalette.commands.selectAll", icon: CheckSquare, section: "commandPalette.sections.actions", action: () => selectAll() },
    { id: "action-clear-selection", labelKey: "commandPalette.commands.clearSelection", icon: X, section: "commandPalette.sections.actions", action: () => clearSelection() },
    { id: "action-delete-selected", labelKey: "commandPalette.commands.deleteSelected", icon: Trash2, section: "commandPalette.sections.actions", action: () => { selectedIds.forEach((id) => deleteImage(id)) } },
    { id: "sort-date", labelKey: "commandPalette.commands.sortByDate", icon: ArrowDownAZ, section: "commandPalette.sections.sort", action: () => setSortBy("date") },
    { id: "sort-rating", labelKey: "commandPalette.commands.sortByRating", icon: ArrowUpAZ, section: "commandPalette.sections.sort", action: () => setSortBy("rating") },
    { id: "sort-size", labelKey: "commandPalette.commands.sortBySize", icon: HardDrive, section: "commandPalette.sections.sort", action: () => setSortBy("size") },
  ], [setView, selectAll, clearSelection, setSortBy, deleteImage, selectedIds])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) => {
      const label = t(cmd.labelKey).toLowerCase()
      return label.includes(q) || cmd.id.includes(q)
    })
  }, [commands, query, t])

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const cmd of filtered) {
      const list = map.get(cmd.section) || []
      list.push(cmd)
      map.set(cmd.section, list)
    }
    return map
  }, [filtered])

  const flatCommands = filtered

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

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
        className="absolute inset-0 bg-black/35"
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
              {t("commandPalette.noResults")}
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
                      <span className="flex-1">{t(cmd.labelKey)}</span>
                      {cmd.hint && (
                        <span className="text-[9px] font-serif text-text-faint opacity-60">
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
