import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  Globe,
  Palette,
  Keyboard,
  HardDrive,
  Cpu,
  Info,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"

export function SettingsPage() {
  const { t, locale, setLocale } = useTranslation()

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-[640px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-light tracking-[-0.02em]">
            {t("settings.title")}
          </h1>
          <p className="text-[13px] text-text-muted mt-1">
            {t("settings.subtitle")}
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-5">
          <TabsList className="bg-bg p-0.5 rounded-[8px] border border-border-subtle">
            <TabsTrigger value="general" className="rounded-[6px] text-[12px] px-3.5 py-1.5">
              {t("settings.tabs.general")}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="rounded-[6px] text-[12px] px-3.5 py-1.5">
              {t("settings.tabs.appearance")}
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="rounded-[6px] text-[12px] px-3.5 py-1.5">
              {t("settings.tabs.shortcuts")}
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-[6px] text-[12px] px-3.5 py-1.5">
              {t("settings.tabs.about")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <SettingsSection
              icon={Globe}
              title={t("settings.language.title")}
              description={t("settings.language.description")}
            >
              <div className="flex gap-2">
                {(["en", "zh"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-100",
                      locale === lang
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
              icon={HardDrive}
              title={t("settings.storage.title")}
              description={t("settings.storage.description")}
            >
              <div className="space-y-2">
                <InfoRow label={t("settings.storage.database")} value="lumora.db" />
                <InfoRow label={t("settings.storage.size")} value="24.5 MB" />
                <InfoRow label={t("settings.storage.location")} value="D:\Lumora\data" />
              </div>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <SettingsSection
              icon={Palette}
              title={t("settings.theme.title")}
              description={t("settings.theme.description")}
            >
              <div className="flex gap-2">
                <button className="px-4 py-1.5 rounded-full text-[12px] font-medium bg-text text-surface">
                  {t("settings.theme.light")}
                </button>
                <button className="px-4 py-1.5 rounded-full text-[12px] font-medium bg-bg text-text-secondary hover:bg-surface-hover transition-colors border border-border-subtle">
                  {t("settings.theme.dark")}
                </button>
              </div>
            </SettingsSection>

            <SettingsSection
              icon={Cpu}
              title={t("settings.grid.title")}
              description={t("settings.grid.description")}
            >
              <div className="flex gap-1.5">
                {[3, 4, 5].map((cols) => (
                  <button
                    key={cols}
                    className={cn(
                      "w-10 h-10 rounded-[8px] text-[12px] font-semibold transition-colors duration-100",
                      cols === 4
                        ? "bg-text text-surface"
                        : "bg-bg text-text-secondary hover:bg-surface-hover border border-border-subtle"
                    )}
                  >
                    {cols}
                  </button>
                ))}
              </div>
            </SettingsSection>
          </TabsContent>

          <TabsContent value="shortcuts" className="space-y-4">
            <SettingsSection
              icon={Keyboard}
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
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <SettingsSection
              icon={Info}
              title={t("settings.about.title")}
              description={t("settings.about.description")}
            >
              <div className="space-y-2">
                <InfoRow label={t("settings.about.version")} value="0.1.0" />
                <InfoRow label={t("settings.about.engine")} value="Tauri 2" />
                <InfoRow label={t("settings.about.frontend")} value="React 19" />
              </div>
            </SettingsSection>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5 rounded-[12px] shadow-card border-0">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-[8px] bg-bg border border-border-subtle flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-text-muted" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-[13px] font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="text-[12px] text-text-muted mt-0.5">{description}</p>
          </div>
          {children}
        </div>
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
