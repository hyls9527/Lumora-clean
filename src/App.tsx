import { useEffect } from "react"
import { I18nProvider } from "@/lib/i18n"
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
  const { view, detailImage, isLoading, error, loadImages } = useAppStore()

  useEffect(() => {
    loadImages()
  }, [loadImages])

  const renderPage = () => {
    switch (view) {
      case "gallery":
        return <div key="gallery" className="animate-in fade-in duration-200"><GalleryPage /></div>
      case "curation":
        return <div key="curation" className="animate-in fade-in duration-200"><CurationPage /></div>
      case "dashboard":
        return <div key="dashboard" className="animate-in fade-in duration-200"><DashboardPage /></div>
      case "settings":
        return <div key="settings" className="animate-in fade-in duration-200"><SettingsPage /></div>
      case "trash":
        return <div key="trash" className="animate-in fade-in duration-200"><TrashPage /></div>
      default:
        return <GalleryPage />
    }
  }

  return (
    <div className="flex h-screen bg-bg">
      {/* Skip navigation link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded"
      >
        跳到主内容
      </a>
      <Sidebar />
      <main id="main-content" role="main" aria-label="主内容区" className="flex-1 overflow-auto bg-bg px-10">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-2 border-accent/20 rounded-full animate-ping" />
                <div className="absolute inset-2 border-2 border-accent/40 rounded-full animate-pulse" />
                <div className="absolute inset-4 border-2 border-accent rounded-full" />
              </div>
              <p className="font-serif text-[15px] text-text-muted">研墨中…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="font-serif text-[14px] text-danger mb-3">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-[4px] font-serif text-[12px] bg-accent text-white hover:bg-accent-hover transition-all duration-200 ease-out"
              >
                重试
              </button>
            </div>
          </div>
        ) : (
          renderPage()
        )}
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
