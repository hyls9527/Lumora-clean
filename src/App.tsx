import { I18nProvider, useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sidebar } from "@/components/Sidebar"
import { DetailPanel } from "@/components/DetailPanel"
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
      {renderPage()}
      {detailImage && <DetailPanel />}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </I18nProvider>
  )
}
