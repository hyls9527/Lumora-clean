import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

const NAV_ITEMS = [
  { id: "gallery" as const, labelKey: "sidebar.gallery" },
  { id: "curation" as const, labelKey: "sidebar.curation" },
  { id: "dashboard" as const, labelKey: "sidebar.dashboard" },
  { id: "settings" as const, labelKey: "sidebar.settings" },
  { id: "trash" as const, labelKey: "sidebar.trash" },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { view, setView, images } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const stats = {
    total: images.length,
    favorites: images.filter((i) => i.favorite).length,
    rated: images.filter((i) => i.rating > 0).length,
  }

  return (
    <aside 
      className={cn(
        "relative h-screen flex flex-col bg-surface border-r border-border shrink-0 transition-all duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[200px]"
      )}
      aria-label="侧边栏"
    >
      {/* Gold line decoration — right edge */}
      <div
        className="absolute top-[60px] bottom-[60px] right-0 w-px pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(122,92,18,0.12) 20%, rgba(122,92,18,0.12) 80%, transparent)",
        }}
      />

      {/* Logo */}
      <div className={cn("pt-9 pb-7 border-b border-border-subtle", collapsed ? "px-3" : "px-5")}>
        <h1 className={cn("font-serif font-light tracking-[0.08em] leading-none text-text", collapsed ? "text-[16px] text-center" : "text-[20px]")}>
          {collapsed ? "L" : "Lumora"}
        </h1>
        {!collapsed && (
          <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted mt-2 leading-none font-sans font-normal">
            {t("sidebar.subtitle")}
          </p>
        )}
      </div>

      {/* Search */}
      <div className={cn("my-5", collapsed ? "mx-2" : "mx-4")}>
        <button
          className={cn(
            "group flex items-center gap-2 rounded-[4px] bg-bg border border-border-subtle hover:bg-surface-hover focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all duration-200 ease-out",
            collapsed ? "w-10 h-10 justify-center px-0" : "w-full px-3 py-2"
          )}
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          aria-label={collapsed ? "搜索 (⌘K)" : undefined}
        >
          <span className="text-text-faint text-[11px] opacity-40">⌘</span>
          {!collapsed && (
            <span className="font-serif text-[12px] text-text-muted font-light flex-1 text-left">{t("sidebar.search")}</span>
          )}
          {!collapsed && (
            <kbd className="font-serif text-[9px] text-text-faint opacity-0 group-hover:opacity-50 transition-opacity">
              ⌘K
            </kbd>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="主导航" className="flex-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "relative w-full flex items-center gap-2.5 transition-all duration-200 ease-out",
                collapsed ? "justify-center px-0 py-2" : "px-3 py-[7px] text-[13px]",
                isActive
                  ? "font-serif font-semibold text-text mt-1.5 mb-2"
                  : "font-serif font-normal text-text-secondary hover:bg-surface-hover"
              )}
              title={collapsed ? t(item.labelKey) : undefined}
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
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </button>
          )
        })}
      </nav>

      {/* Stats */}
      {!collapsed && (
        <div className="mx-4 mb-6">
          <div className="px-4 py-3.5 rounded-[2px] bg-bg border border-border-subtle">
            <div className="space-y-2.5">
              <StatRow label={t("sidebar.total")} value={stats.total} />
              <div className="border-t border-dotted" style={{ borderColor: "rgba(139,115,75,0.06)" }} />
              <StatRow
                label={t("sidebar.favorites")}
                value={stats.favorites}
                icon={<span className="text-accent text-[10px]">◆</span>}
              />
              <div className="border-t border-dotted" style={{ borderColor: "rgba(139,115,75,0.06)" }} />
              <StatRow label={t("sidebar.rated")} value={stats.rated} />
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface border border-border-subtle flex items-center justify-center text-text-muted hover:bg-surface-hover transition-all duration-200 ease-out",
          "opacity-0 hover:opacity-100",
          isMobile && "opacity-100 shadow-card"
        )}
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        <span className="text-[10px]">{collapsed ? "→" : "←"}</span>
      </button>
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
