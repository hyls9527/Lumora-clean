import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, X, Hash } from "lucide-react"

const TAG_COLORS = [
  { name: "amber", bg: "bg-amber-100/60", text: "text-amber-800", dot: "bg-amber-600" },
  { name: "stone", bg: "bg-stone-200/60", text: "text-stone-700", dot: "bg-stone-500" },
  { name: "rose", bg: "bg-rose-100/60", text: "text-rose-800", dot: "bg-rose-600" },
  { name: "emerald", bg: "bg-emerald-100/60", text: "text-emerald-800", dot: "bg-emerald-600" },
  { name: "sky", bg: "bg-sky-100/60", text: "text-sky-800", dot: "bg-sky-600" },
  { name: "violet", bg: "bg-violet-100/60", text: "text-violet-800", dot: "bg-violet-600" },
]

interface TagManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagManager({ open, onOpenChange }: TagManagerProps) {
  const { t } = useTranslation()
  const { tags, addTag, removeTag, images } = useAppStore()
  const [newTagName, setNewTagName] = useState("")
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0])

  const tagCounts = new Map<string, number>()
  for (const img of images) {
    for (const tag of img.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  function handleCreate() {
    const name = newTagName.trim()
    if (!name) return
    if (tags.some((t) => t.name === name)) return
    addTag({ name, color: selectedColor.name })
    setNewTagName("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[6px] bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-serif text-[16px] font-semibold text-text">
            {t("tags.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Create new tag */}
        <div className="flex gap-2">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("tags.placeholder")}
            className="font-serif text-[13px] rounded-[4px] bg-bg border-border-subtle"
          />
          <Button
            onClick={handleCreate}
            disabled={!newTagName.trim()}
            size="icon-sm"
            className="shrink-0 rounded-[4px]"
          >
          </Button>
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted">{t("tags.color")}</span>
          <div className="flex gap-1.5">
            {TAG_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => setSelectedColor(color)}
                className={cn(
                  "w-5 h-5 rounded-full transition-all duration-200 ease-out",
                  color.dot,
                  selectedColor.name === color.name
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                    : "opacity-60 hover:opacity-100"
                )}
              />
            ))}
          </div>
        </div>

        {/* Tag list */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {tags.length === 0 ? (
            <div className="text-center py-6">
              <span className="font-serif text-[20px] text-text-faint mb-2 block">◆</span>
              <p className="text-[12px] text-text-faint">{t("tags.empty")}</p>
            </div>
          ) : (
            tags.map((tag) => {
              const color = TAG_COLORS.find((c) => c.name === tag.color) ?? TAG_COLORS[0]
              const count = tagCounts.get(tag.name) ?? 0
              return (
                <div
                  key={tag.name}
                  className="flex items-center justify-between px-3 py-2 rounded-[4px] hover:bg-surface-hover transition-colors duration-200 ease-out group"
                >
                  <div className="flex items-center gap-2.5">
                    <Badge
                      className={cn(
                        "rounded-[4px] font-serif text-[11px] px-2 py-0.5",
                        color.bg,
                        color.text
                      )}
                    >
                      {tag.name}
                    </Badge>
                    <span className="text-[11px] text-text-faint">{count}</span>
                  </div>
                  <button
                    onClick={() => removeTag(tag.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out"
                  >
                    <X className="w-3.5 h-3.5 text-text-muted hover:text-danger" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-[4px] font-serif text-[12px]"
          >
            {t("tags.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* Tag filter bar for gallery */
export function TagFilterBar() {
  const { t } = useTranslation()
  const { tags, activeTagFilters, toggleTagFilter, clearTagFilters, images } = useAppStore()

  const tagCounts = new Map<string, number>()
  for (const img of images) {
    for (const tag of img.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint font-sans shrink-0">
        {t("tags.filter")}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {tags.map((tag) => {
        const color = TAG_COLORS.find((c) => c.name === tag.color) ?? TAG_COLORS[0]
        const isActive = activeTagFilters.has(tag.name)
        const count = tagCounts.get(tag.name) ?? 0
        return (
          <button
            key={tag.name}
            onClick={() => toggleTagFilter(tag.name)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-serif text-[11px] transition-all duration-200 ease-out",
              "hover:shadow-sm hover:scale-105 active:scale-95",
              isActive
                ? "bg-text text-surface shadow-md"
                : cn(color.bg, color.text, "hover:brightness-95")
            )}
          >
            {tag.name}
            <span className={cn(
              "text-[9px] ml-0.5",
              isActive ? "text-surface/70" : "opacity-60"
            )}>
              {count}
            </span>
          </button>
        )
      })}
      </div>
      {activeTagFilters.size > 0 && (
        <button
          onClick={clearTagFilters}
          className="text-[10px] text-text-muted hover:text-danger transition-colors duration-200 ease-out ml-1"
        >
          {t("tags.clearFilters")}
        </button>
      )}
    </div>
  )
}
