import { useEffect, useState, Suspense, useCallback } from 'react';
import { Sidebar } from './components/ui/Sidebar';
import { MobileNav } from './components/ui/MobileNav';
import { CommandPalette } from './components/ui/CommandPalette';
import { DropOverlay } from './components/ui/DropOverlay';
import { LoadingPage } from './components/ui/LoadingPage';
import { useSettingsStore } from './stores/settingsStore';
import { useCommandStore } from './stores/commandStore';
import { useDragDrop } from './hooks/useDragDrop';
import { useImageSearchStore } from './stores/imageSearchStore';
import { useAutoClearError } from './hooks/useAutoClearError';
import { useImageStore } from './stores/imageStore';
import { useTrashStore } from './stores/trashStore';
import { useImageTagsStore } from './stores/imageTagsStore';
import { useAiAnalysisStore } from './stores/aiAnalysisStore';
import { useEmbeddingStore } from './stores/embeddingStore';
import { useSemanticSearchStore } from './stores/semanticSearchStore';
import { useIsMobile } from './hooks/useMediaQuery';
import { usePerformanceMonitor } from './hooks/usePerformance';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useRouter, useRouteCommands, useGlobalShortcuts } from './hooks/useRouter';
import { getRouteDef, preloadRoutes, type RoutePath } from './routes';
import { SplashScreen } from './components/ui/SplashScreen';
import { FirstRunModal } from './components/ui/FirstRunModal';
import { getSetting, setSetting } from './lib/api/settings';
import { t } from './lib/i18n';
import { t as tok } from './lib/tokens';
import { filterDropPaths } from './lib/dropPaths';
import { isDirectory } from './lib/api/fs';

function App() {
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const { toggle } = useCommandStore();
  const isMobile = useIsMobile();

  const { route, routeDef, navigate } = useRouter();

  usePerformanceMonitor('App');
  useAutoClearError(useImageStore);
  useAutoClearError(useTrashStore);
  useAutoClearError(useSettingsStore);
  useAutoClearError(useImageTagsStore);
  useAutoClearError(useAiAnalysisStore);
  useAutoClearError(useEmbeddingStore);
  useAutoClearError(useSemanticSearchStore);
  useAutoClearError(useImageSearchStore);

  // Register route commands + global shortcuts
  const refreshGallery = useCallback(() => {
    navigate('/gallery' as RoutePath);
    void useImageStore.getState().fetchImages(1);
  }, [navigate]);

  useRouteCommands(navigate, refreshGallery);
  useGlobalShortcuts(navigate, refreshGallery);

  // Auto-navigate to search when image search is triggered
  const imageSearchSource = useImageSearchStore((s) => s.sourceImageId);
  useEffect(() => {
    if (imageSearchSource) {
      navigate('/search' as RoutePath);
      useImageSearchStore.getState().clearSource();
    }
  }, [imageSearchSource, navigate]);

  useEffect(() => {
    // Warm up lazy route chunks and wait for settings hydration so the
    // splash can reveal an already-responsive app (seamless startup).
    void preloadRoutes();
    void hydrate().then(() => setAppReady(true));
  }, [hydrate]);

  // First launch: ask how imports should store images before any import.
  useEffect(() => {
    void getSetting('store_mode')
      .then((v) => {
        if (v === null) setFirstRunOpen(true);
      })
      .catch(() => {});
  }, []);

  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // Drag-and-drop: import files when dropped on window
  const handleDrop = useCallback(
    (paths: string[]) => {
      void filterDropPaths(paths, isDirectory).then((dropPaths) => {
        if (dropPaths.length > 0) {
          setDroppedPaths(dropPaths);
          navigate('/import' as RoutePath);
        }
      });
    },
    [navigate],
  );

  const { isDragging } = useDragDrop({ onDrop: handleDrop });

  const renderPage = () => {
    if (!routeDef) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tok.textSecondary,
            fontFamily: tok.fontDisplay,
            fontSize: 14,
          }}
        >
          {t('common.notFound')}
        </div>
      );
    }

    // Import page gets droppedPaths prop
    if (route === '/import') {
      const ImportPage = getRouteDef('/import')!.component;
      return (
        <ErrorBoundary key="import">
          <Suspense fallback={<LoadingPage />}>
            <ImportPage droppedPaths={droppedPaths} onPathsConsumed={() => setDroppedPaths([])} />
          </Suspense>
        </ErrorBoundary>
      );
    }

    const PageComponent = routeDef.component;
    return (
      <ErrorBoundary key={route}>
        <Suspense fallback={<LoadingPage />}>
          <PageComponent />
        </Suspense>
      </ErrorBoundary>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {!isMobile && <Sidebar activeRoute={route} onNavigate={navigate} onSearch={toggle} />}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          paddingBottom: isMobile ? 56 : 0,
        }}
      >
        <div key={route} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {renderPage()}
        </div>
      </main>
      <CommandPalette navigate={navigate} />
      <DropOverlay isVisible={isDragging} />
      {isMobile && <MobileNav activeRoute={route} onNavigate={navigate} />}
      {!splashDone && <SplashScreen ready={appReady} onFinish={handleSplashFinish} />}
      <FirstRunModal
        open={splashDone && firstRunOpen}
        onChoose={(mode) => {
          void setSetting('store_mode', mode).catch(() => {});
          setFirstRunOpen(false);
        }}
      />
    </div>
  );
}

export default App;
