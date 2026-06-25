import { useEffect, useState } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { CommandPalette } from './components/ui/CommandPalette';
import { GalleryPage } from './features/gallery/GalleryPage';
import { ImportPage } from './features/import/ImportPage';
import { SearchPage } from './features/search/SearchPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TrashPage } from './features/trash/TrashPage';
import { TagManager } from './features/tags/TagManager';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ExportPage } from './features/export/ExportPage';
import { useSettingsStore } from './stores/settingsStore';
import { useCommandStore } from './stores/commandStore';
import { useTranslation } from './lib/i18n';
import type { Command } from './stores/commandStore';

function App() {
  const [route, setRoute] = useState('/gallery');
  const hydrate = useSettingsStore((s) => s.hydrate);
  const { toggle, registerCommands } = useCommandStore();
  const { t } = useTranslation();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Register default commands
  useEffect(() => {
    const commands: Command[] = [
      // Navigation
      { id: 'nav-gallery', name: t('nav.creatorGallery'), description: t('commandPalette.descGallery'), section: 'navigation', action: () => setRoute('/gallery') },
      { id: 'nav-dashboard', name: t('nav.dashboard'), description: t('commandPalette.descDashboard'), section: 'navigation', action: () => setRoute('/dashboard') },
      { id: 'nav-import', name: t('nav.import'), description: t('commandPalette.descImport'), section: 'navigation', action: () => setRoute('/import') },
      { id: 'nav-search', name: t('nav.search'), description: t('commandPalette.descSearch'), section: 'navigation', action: () => setRoute('/search') },
      { id: 'nav-tags', name: t('nav.tags'), description: t('commandPalette.descTags'), section: 'navigation', action: () => setRoute('/tags') },
      { id: 'nav-export', name: t('nav.export'), description: t('commandPalette.descExport'), section: 'navigation', action: () => setRoute('/export') },
      { id: 'nav-settings', name: t('nav.settings'), description: t('commandPalette.descSettings'), section: 'navigation', action: () => setRoute('/settings') },
      { id: 'nav-trash', name: t('nav.trash'), description: t('commandPalette.descTrash'), section: 'navigation', action: () => setRoute('/trash') },
      // Actions
      { id: 'action-import', name: t('commandPalette.importImages'), description: t('commandPalette.importImagesDesc'), shortcut: '⌘I', section: 'action', action: () => setRoute('/import') },
      { id: 'action-refresh', name: t('commandPalette.refreshGallery'), description: t('commandPalette.refreshGalleryDesc'), shortcut: '⌘R', section: 'action', action: () => setRoute('/gallery') },
      { id: 'action-empty-trash', name: t('commandPalette.emptyTrash'), description: t('commandPalette.emptyTrashDesc'), section: 'action', action: () => setRoute('/trash') },
    ];
    registerCommands(commands);
  }, [registerCommands, t, setRoute]);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const renderPage = () => {
    switch (route) {
      case '/trash':
        return <TrashPage />;
      case '/dashboard':
        return <DashboardPage />;
      case '/gallery':
      case '/normal':
        return <GalleryPage />;
      case '/import':
        return <ImportPage />;
      case '/search':
        return <SearchPage />;
      case '/tags':
        return <TagManager />;
      case '/export':
        return <ExportPage />;
      case '/settings':
        return <SettingsPage />;
      default:
        return (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b5d48',
              fontFamily: 'var(--font-display)',
              fontSize: 14,
            }}
          >
            页面开发中…
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeRoute={route} onNavigate={setRoute} />
      {renderPage()}
      <CommandPalette />
    </div>
  );
}

export default App;
