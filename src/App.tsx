import { I18nProvider, useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sidebar } from "@/components/Sidebar"
import { DetailPanel } from "@/components/DetailPanel"
import { CommandPalette } from "@/components/CommandPalette"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { GalleryPage } from "@/pages/GalleryPage"
import { CurationPage } from "@/pages/CurationPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { TrashPage } from "@/pages/TrashPage"

function AppContent() {
  const { view, detailImage } = useAppStore()

  const renderPage = () => {
    switch (view) {
      case "gallery":
        return <GalleryPage />
      case "curation":
        return <CurationPage />
      case "dashboard":
        return <DashboardPage />
      case "settings":
        return <SettingsPage />
      case "trash":
        return <TrashPage />
      default:
        return <GalleryPage />
    }
  }

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-bg px-10">
        {renderPage()}
      </main>
      {detailImage && <DetailPanel />}
      <CommandPalette />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </I18nProvider>
    </ErrorBoundary>
  )
}
