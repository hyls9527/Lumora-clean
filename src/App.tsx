import { useEffect, useState } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { GalleryPage } from './features/gallery/GalleryPage';
import { ImportPage } from './features/import/ImportPage';
import { SearchPage } from './features/search/SearchPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TrashPage } from './features/trash/TrashPage';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const [route, setRoute] = useState('/gallery');
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const renderPage = () => {
    switch (route) {
      case '/trash':
        return <TrashPage />;
      case '/gallery':
      case '/normal':
        return <GalleryPage />;
      case '/import':
        return <ImportPage />;
      case '/search':
        return <SearchPage />;
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
    </div>
  );
}

export default App;
