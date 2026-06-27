import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { CommandPalette } from './components/ui/CommandPalette';
import { DropOverlay } from './components/ui/DropOverlay';
import { GalleryPage } from './features/gallery/GalleryPage';
import { useSettingsStore } from './stores/settingsStore';
import { useCommandStore } from './stores/commandStore';
import { useDragDrop } from './hooks/useDragDrop';
import { useTranslation } from './lib/i18n';
import type { Command } from './stores/commandStore';

const ImportPage = lazy(() => import('./features/import/ImportPage'));
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const TrashPage = lazy(() => import('./features/trash/TrashPage'));
const TagManager = lazy(() => import('./features/tags/TagManager'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ExportPage = lazy(() => import('./features/export/ExportPage'));

function App() {
  const [route, setRoute] = useState('/gallery');
  const hydrate = useSettingsStore((s) => s.hydrate);
  const { toggle, registerCommands } = useCommandStore();
  const { t } = useTranslation();

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
        // Store dropped paths for ImportPage to pick up
        (window as unknown as Record<string, unknown>).__droppedPaths = imagePaths;
      }
    },
    [setRoute],
  );

  const { isDragging } = useDragDrop({ onDrop: handleDrop });

  const renderPage = () => {
    switch (route) {
      case '/trash': return <Suspense fallback={<Loading />}><TrashPage /></Suspense>;
      case '/dashboard': return <Suspense fallback={<Loading />}><DashboardPage /></Suspense>;
      case '/gallery': case '/normal': return <GalleryPage />;
      case '/import': return <Suspense fallback={<Loading />}><ImportPage /></Suspense>;
      case '/search': return <Suspense fallback={<Loading />}><SearchPage /></Suspense>;
      case '/tags': return <Suspense fallback={<Loading />}><TagManager /></Suspense>;
      case '/export': return <Suspense fallback={<Loading />}><ExportPage /></Suspense>;
      case '/settings': return <Suspense fallback={<Loading />}><SettingsPage /></Suspense>;
      default: return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#6b5d48',fontFamily:'var(--font-display)',fontSize:14}}>页面开发中…</div>;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeRoute={route} onNavigate={setRoute} />
      {renderPage()}
      <CommandPalette />
      <DropOverlay isVisible={isDragging} />
    </div>
  );
}

function Loading() {
  return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#a09480',fontFamily:'var(--font-body)',fontSize:13}}>加载中…</div>;
}

export default App;
