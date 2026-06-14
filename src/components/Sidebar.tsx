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
    <aside className="relative w-[200px] h-screen flex flex-col bg-surface border-r border-border shrink-0">
      {/* Gold line decoration — right edge */}
      <div
        className="absolute right-0 w-px pointer-events-none"
        style={{
          top: 60,
          bottom: 60,
          background:
            "linear-gradient(to bottom, transparent, rgba(139,105,20,0.12), transparent)",
        }}
      />

      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-serif text-[15px] font-light tracking-[0.08em] leading-none text-text">
          Lumora
        </h1>
        <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted mt-1.5 leading-none">
          {t("sidebar.subtitle")}
        </p>
      </div>

      {/* Search */}
      <div className="px-3 mb-1">
        <button
          className="w-full flex items-center gap-2 px-3 py-[7px] rounded-[6px] text-[13px] text-text-muted bg-bg border border-border-subtle hover:bg-surface-hover transition-colors"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <Search className="w-3.5 h-3.5 opacity-40" />
          <span className="font-serif flex-1 text-left">{t("sidebar.search")}</span>
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
                "relative w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] transition-colors",
                isActive
                  ? "font-serif font-semibold mt-1.5 mb-2 text-text"
                  : "font-serif font-normal text-text-secondary hover:bg-surface-hover"
              )}
            >
              {/* Active gold left bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-accent rounded-full" />
              )}
              {/* Dot indicator */}
              <span
                className={cn(
                  "w-[3px] h-[3px] rounded-full shrink-0",
                  isActive ? "bg-accent" : "bg-text-faint"
                )}
              />
              <Icon className={cn("w-4 h-4", isActive ? "opacity-90" : "opacity-60")} />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        })}
      </nav>

      {/* Stats */}
      <div className="px-3 pb-4">
        <div className="px-3 py-3 rounded-[6px] bg-bg border border-border-subtle">
          <div className="space-y-2.5">
            <StatRow label={t("sidebar.total")} value={stats.total} />
            <div className="h-px border-t border-dotted border-border" />
            <StatRow
              label={t("sidebar.favorites")}
              value={stats.favorites}
              icon={<Star className="w-3 h-3 text-accent fill-accent" />}
            />
            <div className="h-px border-t border-dotted border-border" />
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
      <span className="text-[9px] font-medium uppercase tracking-[0.04em] text-text-faint">
        {label}
      </span>
      <span className="text-[13px] font-medium tabular-nums flex items-center gap-1.5" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {icon}
        {value}
      </span>
    </div>
  )
}
