import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { PageErrorBoundary } from "@/components/PageErrorBoundary"
import { useSettingsStore } from "@/stores/settings-store"
import { Card } from "@/components/ui/card"

const TABS = ["general", "appearance", "shortcuts", "about"] as const
type Tab = typeof TABS[number]

export function SettingsPage() {
  const { t, setLocale } = useTranslation()
  const {
    language,
    theme,
    gridColumns,
    loadSettings,
    setLanguage,
    setTheme,
    setGridColumns,
  } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<Tab>("general")

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <PageErrorBoundary>
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-[640px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-[17px] font-light tracking-[0.02em]">
            {t("settings.title")}
          </h1>
          <p className="text-[13px] text-text-muted mt-1">
            {t("settings.subtitle")}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border-subtle mb-5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-[12px] font-serif border-b-2 transition-all duration-200 ease-out",
                activeTab === tab
                  ? "border-accent text-text"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              )}
            >
              {t(`settings.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "general" && (
          <div className="space-y-4">
            <SettingsSection

              title={t("settings.language.title")}
              description={t("settings.language.description")}
            >
              <div className="flex gap-2">
                {(["en", "zh"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setLocale(lang) }}
                    className={cn(
                      "px-4 py-1.5 rounded-[4px] text-[12px] font-medium transition-all duration-200 ease-out",
                      language === lang
                        ? "bg-text text-surface"
                        : "bg-bg text-text-secondary hover:bg-surface-hover border border-border-subtle"
                    )}
                  >
                    {lang === "en" ? "English" : "中文"}
                  </button>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection

              title={t("settings.storage.title")}
              description={t("settings.storage.description")}
            >
              <div className="space-y-2">
                <InfoRow label={t("settings.storage.database")} value="lumora.db" />
                <InfoRow label={t("settings.storage.size")} value="24.5 MB" />
                <InfoRow label={t("settings.storage.location")} value="D:\\Lumora\\data" />
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-4">
            <SettingsSection

              title={t("settings.theme.title")}
              description={t("settings.theme.description")}
            >
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    className={cn(
                      "px-4 py-1.5 rounded-[4px] text-[12px] font-medium transition-all duration-200 ease-out",
                      theme === th
                        ? "bg-text text-surface"
                        : "bg-bg text-text-secondary hover:bg-surface-hover border border-border-subtle"
                    )}
                  >
                    {th === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection

              title={t("settings.grid.title")}
              description={t("settings.grid.description")}
            >
              <div className="flex gap-1.5">
                {[3, 4, 5].map((cols) => (
                  <button
                    key={cols}
                    onClick={() => setGridColumns(cols)}
                    className={cn(
                      "w-10 h-10 rounded-[4px] text-[12px] font-semibold transition-all duration-200 ease-out",
                      gridColumns === cols
                        ? "bg-text text-surface"
                        : "bg-bg text-text-secondary hover:bg-surface-hover border border-border-subtle"
                    )}
                  >
                    {cols}
                  </button>
                ))}
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === "shortcuts" && (
          <div className="space-y-4">
            <SettingsSection

              title={t("settings.shortcuts.title")}
              description={t("settings.shortcuts.description")}
            >
              <div className="space-y-2">
                <ShortcutRow action={t("settings.shortcuts.search")} keys="⌘ K" />
                <ShortcutRow action={t("settings.shortcuts.selectAll")} keys="⌘ A" />
                <ShortcutRow action={t("settings.shortcuts.delete")} keys="⌫" />
                <ShortcutRow action={t("settings.shortcuts.favorite")} keys="F" />
                <ShortcutRow action={t("settings.shortcuts.close")} keys="Esc" />
              </div>
            </SettingsSection>
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-4">
            <SettingsSection

              title={t("settings.about.title")}
              description={t("settings.about.description")}
            >
              <div className="space-y-2">
                <InfoRow label={t("settings.about.version")} value="0.1.0" />
                <InfoRow label={t("settings.about.engine")} value="Vite (Web)" />
                <InfoRow label={t("settings.about.frontend")} value="React 19" />
              </div>
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
    </PageErrorBoundary>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5 rounded-[2px] shadow-card border-0">
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-[-0.01em]">{title}</h3>
          <p className="text-[12px] text-text-muted mt-0.5">{description}</p>
        </div>
        {children}
      </div>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12px] text-text-faint">{label}</span>
      <span className="text-[11px] font-mono text-text-secondary">{value}</span>
    </div>
  )
}

function ShortcutRow({ action, keys }: { action: string; keys: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-text-secondary">{action}</span>
      <kbd className="px-2 py-0.5 rounded-[4px] bg-bg text-[10px] font-mono text-text-muted border border-border-subtle">
        {keys}
      </kbd>
    </div>
  )
}
