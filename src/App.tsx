import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { CommandPalette } from './components/ui/CommandPalette';
import { DropOverlay } from './components/ui/DropOverlay';
import { GalleryPage } from './features/gallery/GalleryPage';
import { useSettingsStore } from './stores/settingsStore';
import { useCommandStore } from './stores/commandStore';
import { useDragDrop } from './hooks/useDragDrop';
import { useImageSearchStore } from './stores/imageSearchStore';
import { useTranslation, t } from './lib/i18n';
import { t as tok } from './lib/tokens';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import type { Command } from './stores/commandStore';

const ImportPage = lazy(() => import('./features/import/ImportPage'));
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const TrashPage = lazy(() => import('./features/trash/TrashPage'));
const TagManager = lazy(() => import('./features/tags/TagManager'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ExportPage = lazy(() => import('./features/export/ExportPage'));
const FavoritesPage = lazy(() => import('./features/favorites/FavoritesPage'));

function App() {
  const [route, setRoute] = useState('/gallery');
  const hydrate = useSettingsStore((s) => s.hydrate);
  const { toggle, registerCommands } = useCommandStore();
  const { t } = useTranslation();

  // Auto-navigate to search when image search is triggered
  const imageSearchSource = useImageSearchStore((s) => s.sourceImageId);
  useEffect(() => {
    if (imageSearchSource) { setRoute('/search'); useImageSearchStore.getState().clearSource(); }
  }, [imageSearchSource]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    const commands: Command[] = [
      { id: 'nav-gallery', name: t('nav.creatorGallery'), description: t('commandPalette.descGallery'), section: 'navigation', action: () => setRoute('/gallery') },
      { id: 'nav-dashboard', name: t('nav.dashboard'), description: t('commandPalette.descDashboard'), section: 'navigation', action: () => setRoute('/dashboard') },
      { id: 'nav-import', name: t('nav.import'), description: t('commandPalette.descImport'), section: 'navigation', action: () => setRoute('/import') },
      { id: 'nav-search', name: t('nav.search'), description: t('commandPalette.descSearch'), section: 'navigation', action: () => setRoute('/search') },
      { id: 'nav-tags', name: t('nav.tags'), description: t('commandPalette.descTags'), section: 'navigation', action: () => setRoute('/tags') },
      { id: 'nav-export', name: t('nav.export'), description: t('commandPalette.descExport'), section: 'navigation', action: () => setRoute('/export') },
      { id: 'nav-settings', name: t('nav.settings'), description: t('commandPalette.descSettings'), section: 'navigation', action: () => setRoute('/settings') },
      { id: 'nav-trash', name: t('nav.trash'), description: t('commandPalette.descTrash'), section: 'navigation', action: () => setRoute('/trash') },
      { id: 'action-import', name: t('commandPalette.importImages'), description: t('commandPalette.importImagesDesc'), shortcut: '⌘I', section: 'action', action: () => setRoute('/import') },
      { id: 'action-refresh', name: t('commandPalette.refreshGallery'), description: t('commandPalette.refreshGalleryDesc'), shortcut: '⌘R', section: 'action', action: () => setRoute('/gallery') },
      { id: 'action-empty-trash', name: t('commandPalette.emptyTrash'), description: t('commandPalette.emptyTrashDesc'), section: 'action', action: () => setRoute('/trash') },
    ];
    registerCommands(commands);
  }, [registerCommands, t, setRoute]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  // Drag-and-drop: import files when dropped on window
  const handleDrop = useCallback(
    (paths: string[]) => {
      // Filter for image files
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
      const imagePaths = paths.filter((p) => {
        const ext = p.toLowerCase().slice(p.lastIndexOf('.'));
        return imageExts.includes(ext);
      });

      if (imagePaths.length > 0) {
        // Navigate to import page with dropped files
        setRoute('/import');
      }
    },
    [setRoute],
  );

  const { isDragging } = useDragDrop({ onDrop: handleDrop });

  const renderPage = () => {
    switch (route) {
      case '/trash': return <ErrorBoundary key="trash"><Suspense fallback={<Loading />}><TrashPage /></Suspense></ErrorBoundary>;
      case '/dashboard': return <ErrorBoundary key="dashboard"><Suspense fallback={<Loading />}><DashboardPage /></Suspense></ErrorBoundary>;
      case '/gallery': return <ErrorBoundary key="gallery"><GalleryPage /></ErrorBoundary>;
      case '/import': return <ErrorBoundary key="import"><Suspense fallback={<Loading />}><ImportPage /></Suspense></ErrorBoundary>;
      case '/search': return <ErrorBoundary key="search"><Suspense fallback={<Loading />}><SearchPage /></Suspense></ErrorBoundary>;
      case '/tags': return <ErrorBoundary key="tags"><Suspense fallback={<Loading />}><TagManager /></Suspense></ErrorBoundary>;
      case '/export': return <ErrorBoundary key="export"><Suspense fallback={<Loading />}><ExportPage /></Suspense></ErrorBoundary>;
      case '/favorites': return <ErrorBoundary key="favorites"><Suspense fallback={<Loading />}><FavoritesPage /></Suspense></ErrorBoundary>;
      case '/settings': return <ErrorBoundary key="settings"><Suspense fallback={<Loading />}><SettingsPage /></Suspense></ErrorBoundary>;
      default: return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:tok.textSecondary,fontFamily:'var(--font-display)',fontSize:14}}>{t('common.pageNotFound')}</div>;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar activeRoute={route} onNavigate={setRoute} />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div key={route} style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'pageFadeIn 200ms ease-out' }}>
          {renderPage()}
        </div>
        <style>{`@keyframes pageFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      </main>
      <CommandPalette />
      <DropOverlay isVisible={isDragging} />
    </div>
  );
}

function Loading() {
  return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:tok.textMuted,fontFamily:'var(--font-body)',fontSize:13}}>{t('common.loading')}</div>;
}

export default App;
