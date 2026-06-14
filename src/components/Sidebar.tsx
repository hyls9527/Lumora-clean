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
        className="absolute top-[60px] bottom-[60px] right-0 w-px pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(122,92,18,0.12) 20%, rgba(122,92,18,0.12) 80%, transparent)",
        }}
      />

      {/* Logo */}
      <div className="px-5 pt-9 pb-7 border-b border-border-subtle">
        <h1 className="font-serif text-[20px] font-light tracking-[0.08em] leading-none text-text">
          Lumora
        </h1>
        <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted mt-2 leading-none font-sans font-normal">
          {t("sidebar.subtitle")}
        </p>
      </div>

      {/* Search */}
      <div className="mx-4 my-5">
        <button
          className="group w-full flex items-center gap-2 px-3 py-2 rounded-md bg-bg border border-border-subtle hover:bg-surface-hover transition-colors"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <Search className="w-3.5 h-3.5 opacity-40" />
          <span className="font-serif text-[12px] text-text-muted font-light flex-1 text-left">{t("sidebar.search")}</span>
          <kbd className="font-serif text-[9px] text-text-faint opacity-0 group-hover:opacity-50 transition-opacity">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
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
                  ? "font-serif font-semibold text-text mt-1.5 mb-2"
                  : "font-serif font-normal text-text-secondary hover:bg-surface-hover"
              )}
            >
              {/* Active gold left bar */}
              {isActive && (
                <span className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-accent rounded-full" />
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
      <div className="mx-4 mb-6">
        <div className="px-4 py-3.5 rounded-md bg-bg border border-border-subtle">
          <div className="space-y-2.5">
            <StatRow label={t("sidebar.total")} value={stats.total} />
            <div className="border-t border-dotted" style={{ borderColor: "rgba(139,115,75,0.06)" }} />
            <StatRow
              label={t("sidebar.favorites")}
              value={stats.favorites}
              icon={<Star className="w-3 h-3 text-accent" />}
            />
            <div className="border-t border-dotted" style={{ borderColor: "rgba(139,115,75,0.06)" }} />
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
      <span className="text-[9px] uppercase tracking-[0.1em] text-text-muted font-sans font-normal">
        {label}
      </span>
      <span className="font-sans text-[13px] text-text tabular-nums font-medium flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  )
}
