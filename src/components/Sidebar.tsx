import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import {
  Image,
  Star,
  BarChart3,
  Settings,
  Trash2,
  Search,
  Sparkles,
} from "lucide-react"

const NAV_ITEMS = [
  { id: "gallery" as const, icon: Image, labelKey: "sidebar.gallery" },
  { id: "curation" as const, icon: Sparkles, labelKey: "sidebar.curation" },
  { id: "dashboard" as const, icon: BarChart3, labelKey: "sidebar.dashboard" },
  { id: "settings" as const, icon: Settings, labelKey: "sidebar.settings" },
  { id: "trash" as const, icon: Trash2, labelKey: "sidebar.trash" },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { view, setView, images } = useAppStore()

  const stats = {
    total: images.length,
    favorites: images.filter((i) => i.favorite).length,
    rated: images.filter((i) => i.rating > 0).length,
  }

  return (
    <aside className="w-[240px] h-screen flex flex-col bg-surface shadow-sm shrink-0">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-text" />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold tracking-[-0.01em] leading-none">Lumora</h1>
            <p className="text-[11px] text-text-muted mt-0.5 leading-none">AI Image Manager</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 mb-1">
        <button
          className="w-full flex items-center gap-2 px-3 py-[7px] rounded-[8px] text-[13px] text-text-muted bg-bg hover:bg-surface-hover transition-colors"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <Search className="w-3.5 h-3.5 opacity-40" />
          <span className="flex-1 text-left">{t("sidebar.search")}</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-surface text-text-faint">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-px">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] transition-colors",
                isActive
                  ? "bg-text text-surface font-medium"
                  : "text-text-secondary hover:bg-surface-hover font-normal"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "opacity-90" : "opacity-60")} />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        })}
      </nav>

      {/* Stats */}
      <div className="px-3 pb-4">
        <div className="px-3 py-3 rounded-[10px] bg-bg-alt border border-border-subtle">
          <div className="space-y-2.5">
            <StatRow label={t("sidebar.total")} value={stats.total} />
            <div className="h-px bg-border-subtle" />
            <StatRow
              label={t("sidebar.favorites")}
              value={stats.favorites}
              icon={<Star className="w-3 h-3 text-accent fill-accent" />}
            />
            <div className="h-px bg-border-subtle" />
            <StatRow label={t("sidebar.rated")} value={stats.rated} />
          </div>
        </div>
      </div>
    </aside>
  )
}

function StatRow({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
        {label}
      </span>
      <span className="text-[13px] font-semibold tabular-nums flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  )
}
