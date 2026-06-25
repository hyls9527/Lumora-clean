import { useState } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { GalleryPage } from './features/gallery/GalleryPage';
import { ImportPage } from './features/import/ImportPage';
import { SearchPage } from './features/search/SearchPage';

function App() {
  const [route, setRoute] = useState('/gallery');

  const renderPage = () => {
    switch (route) {
      case '/gallery':
      case '/normal':
        return <GalleryPage />;
      case '/import':
        return <ImportPage />;
      case '/search':
        return <SearchPage />;
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
