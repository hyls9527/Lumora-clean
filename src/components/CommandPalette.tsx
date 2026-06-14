import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { Input } from "@/components/ui/input"
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

  // Group by section
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

  // Global ⌘K / Ctrl+K shortcut
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

  // Listen for external open trigger (e.g. sidebar search button)
  useEffect(() => {
    const handler = () => openPalette()
    window.addEventListener("open-command-palette", handler)
    return () => window.removeEventListener("open-command-palette", handler)
  }, [openPalette])

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Reset focused index when query changes
  useEffect(() => {
    setFocusedIndex(0)
  }, [query])

  // Scroll focused item into view
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"
        onClick={closePalette}
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-[520px] bg-surface rounded-[12px] shadow-card-hover border border-border overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="p-3 border-b border-border-subtle">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.placeholder")}
            className="h-9 text-[13px] border-0 bg-bg focus-visible:ring-0 focus-visible:border-0 rounded-[8px]"
          />
        </div>
        {/* Command list */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {flatCommands.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-text-muted">
              {t("commandPalette.noResults")}
            </div>
          ) : (
            Array.from(grouped.entries()).map(([sectionKey, cmds]) => (
              <div key={sectionKey}>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
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
                        "w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] transition-colors text-left",
                        isFocused
                          ? "bg-surface-hover text-text"
                          : "text-text-secondary hover:bg-surface-hover"
                      )}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      onClick={() => executeCommand(cmd)}
                    >
                      <Icon className="w-4 h-4 shrink-0 opacity-50" />
                      <span className="flex-1">{t(cmd.labelKey)}</span>
                      {cmd.hint && (
                        <kbd className="text-[10px] font-mono text-text-faint">
                          {cmd.hint}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        {/* Footer hint */}
        <div className="flex items-center gap-3 px-3 py-2 border-t border-border-subtle text-[11px] text-text-faint">
          <span>
            <kbd className="font-mono px-1 py-0.5 rounded-[3px] bg-bg-alt border border-border-subtle">
              ↑↓
            </kbd>{" "}
            {t("commandPalette.hints.navigate")}
          </span>
          <span>
            <kbd className="font-mono px-1 py-0.5 rounded-[3px] bg-bg-alt border border-border-subtle">
              ↵
            </kbd>{" "}
            {t("commandPalette.hints.execute")}
          </span>
          <span>
            <kbd className="font-mono px-1 py-0.5 rounded-[3px] bg-bg-alt border border-border-subtle">
              esc
            </kbd>{" "}
            {t("commandPalette.hints.close")}
          </span>
        </div>
      </div>
    </div>
  )
}
