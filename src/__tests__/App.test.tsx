import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import App from '../App';

const h = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  navigate: vi.fn(),
  fetchImages: vi.fn().mockResolvedValue(undefined),
  hydrate: vi.fn().mockResolvedValue(undefined),
  toggle: vi.fn(),
  clearSource: vi.fn(),
  startSession: vi.fn(),
  installHandlers: vi.fn(),
  uninstall: vi.fn(),
  preloadRoutes: vi.fn().mockReturnValue([]),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  isDirectory: vi.fn(),
  route: { value: '/gallery' as string },
  sourceImageId: { value: null as string | null },
  isMobile: { value: false },
  isDragging: { value: false },
  // Swapped per test: the active route definition the router would return.
  routeDef: (() => undefined) as () => unknown,
  dragConfig: null as null | { onDrop: (paths: string[]) => void },
  routeCommands: null as null | [unknown, unknown],
  globalShortcuts: null as null | [unknown, unknown],
}));

vi.mock('../components/ui/Sidebar', () => ({
  Sidebar: ({ activeRoute, onNavigate, onSearch }: { activeRoute: string; onNavigate: (p: string) => void; onSearch: () => void }) => (
    <div data-testid="sidebar" data-route={activeRoute}>
      <button type="button" onClick={() => onNavigate('/trash')}>
        nav-trash
      </button>
      <button type="button" onClick={onSearch}>
        sidebar-search
      </button>
    </div>
  ),
}));

vi.mock('../components/ui/MobileNav', () => ({
  MobileNav: ({ activeRoute, onNavigate }: { activeRoute: string; onNavigate: (p: string) => void }) => (
    <div data-testid="mobile-nav" data-route={activeRoute}>
      <button type="button" onClick={() => onNavigate('/tags')}>
        mobile-tags
      </button>
    </div>
  ),
}));

vi.mock('../components/ui/CommandPalette', () => ({
  CommandPalette: ({ navigate }: { navigate: unknown }) => (
    <div data-testid="command-palette" data-has-nav={String(typeof navigate === 'function')} />
  ),
}));

vi.mock('../components/ui/DropOverlay', () => ({
  DropOverlay: ({ isVisible }: { isVisible: boolean }) => (
    <div data-testid="drop-overlay" data-visible={String(isVisible)} />
  ),
}));

vi.mock('../components/ui/LoadingPage', () => ({
  LoadingPage: () => <div data-testid="loading-page" />,
}));

vi.mock('../components/ui/SplashScreen', () => ({
  SplashScreen: ({ ready, onFinish }: { ready: boolean; onFinish: () => void }) => (
    <div data-testid="splash" data-ready={String(ready)}>
      <button type="button" onClick={onFinish}>
        splash-finish
      </button>
    </div>
  ),
}));

vi.mock('../components/ui/FirstRunModal', () => ({
  FirstRunModal: ({ open, onChoose }: { open: boolean; onChoose: (mode: string) => void }) =>
    open ? (
      <div data-testid="first-run">
        <button type="button" onClick={() => onChoose('copy')}>
          choose-copy
        </button>
        <button type="button" onClick={() => onChoose('reference')}>
          choose-reference
        </button>
      </div>
    ) : null,
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ hydrate: h.hydrate }),
}));

vi.mock('../stores/commandStore', () => ({
  useCommandStore: () => ({ toggle: h.toggle }),
}));

vi.mock('../stores/imageStore', () => ({
  useImageStore: Object.assign(vi.fn(), {
    getState: () => ({ fetchImages: h.fetchImages }),
  }),
}));

vi.mock('../stores/trashStore', () => ({ useTrashStore: vi.fn() }));
vi.mock('../stores/imageTagsStore', () => ({ useImageTagsStore: vi.fn() }));
vi.mock('../stores/aiAnalysisStore', () => ({ useAiAnalysisStore: vi.fn() }));
vi.mock('../stores/embeddingStore', () => ({ useEmbeddingStore: vi.fn() }));
vi.mock('../stores/semanticSearchStore', () => ({ useSemanticSearchStore: vi.fn() }));

vi.mock('../stores/imageSearchStore', () => ({
  useImageSearchStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ sourceImageId: h.sourceImageId.value }),
    { getState: () => ({ clearSource: h.clearSource }) },
  ),
}));

vi.mock('../hooks/useAutoClearError', () => ({ useAutoClearError: vi.fn() }));

vi.mock('../hooks/useDragDrop', () => ({
  useDragDrop: (config: { onDrop: (paths: string[]) => void }) => {
    h.dragConfig = config;
    return { isDragging: h.isDragging.value };
  },
}));

vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => h.isMobile.value,
}));

vi.mock('../hooks/usePerformance', () => ({ usePerformanceMonitor: vi.fn() }));

vi.mock('../hooks/useRouter', () => ({
  useRouter: () => ({ route: h.route.value, routeDef: h.routeDef(), navigate: h.navigate }),
  useRouteCommands: (navigate: unknown, refresh: unknown) => {
    h.routeCommands = [navigate, refresh];
  },
  useGlobalShortcuts: (navigate: unknown, refresh: unknown) => {
    h.globalShortcuts = [navigate, refresh];
  },
}));

vi.mock('../routes', async () => {
  const { createElement } = await import('react');
  const GalleryStub = () => createElement('div', { 'data-testid': 'page-gallery' });
  const ImportStub = ({
    droppedPaths,
    onPathsConsumed,
  }: {
    droppedPaths?: string[];
    onPathsConsumed?: () => void;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'page-import', 'data-paths': (droppedPaths ?? []).join(',') },
      createElement('button', { type: 'button', onClick: onPathsConsumed }, 'consume'),
    );
  const defs: Record<string, { path: string; component: () => ReactNode }> = {
    '/gallery': { path: '/gallery', component: GalleryStub },
    // The import route takes injected props; the harness only needs a
    // component that records them.
    '/import': { path: '/import', component: ImportStub as () => ReactNode },
  };
  return {
    getRouteDef: (path: string) => defs[path],
    preloadRoutes: h.preloadRoutes,
  };
});

vi.mock('../lib/api/settings', () => ({
  getSetting: h.getSetting,
  setSetting: h.setSetting,
}));

vi.mock('../lib/api/fs', () => ({ isDirectory: h.isDirectory }));

vi.mock('../lib/i18n', () => ({
  t: h.t,
  useTranslation: () => ({ t: h.t }),
}));

vi.mock('../lib/reliability', () => ({
  startSession: h.startSession,
  installGlobalCrashHandlers: h.installHandlers,
  recordCrash: vi.fn(),
}));

const GalleryStub = () => createElement('div', { 'data-testid': 'page-gallery' });
const galleryDef = () => ({ path: '/gallery', component: GalleryStub });

h.routeDef = galleryDef;

async function finishSplash() {
  await waitFor(() => expect(screen.getByTestId('splash').dataset.ready).toBe('true'));
  fireEvent.click(screen.getByRole('button', { name: 'splash-finish' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.route.value = '/gallery';
  h.sourceImageId.value = null;
  h.isMobile.value = false;
  h.isDragging.value = false;
  h.dragConfig = null;
  h.routeCommands = null;
  h.globalShortcuts = null;
  h.hydrate.mockResolvedValue(undefined);
  h.fetchImages.mockResolvedValue(undefined);
  h.preloadRoutes.mockReturnValue([]);
  h.installHandlers.mockReturnValue(h.uninstall);
  h.getSetting.mockResolvedValue('copy');
  h.setSetting.mockResolvedValue(undefined);
  h.isDirectory.mockResolvedValue(false);
  h.routeDef = galleryDef;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App startup', () => {
  it('hydrates settings, warms the lazy routes and only then marks the app ready', async () => {
    render(<App />);

    expect(h.preloadRoutes).toHaveBeenCalledTimes(1);
    expect(h.hydrate).toHaveBeenCalledTimes(1);
    // The splash stays in its loading state until hydration settles.
    expect(screen.getByTestId('splash').dataset.ready).toBe('false');

    await waitFor(() => expect(screen.getByTestId('splash').dataset.ready).toBe('true'));
  });

  it('counts the session and installs the crash handlers, removing them on unmount', () => {
    const { unmount } = render(<App />);

    expect(h.startSession).toHaveBeenCalledTimes(1);
    expect(h.installHandlers).toHaveBeenCalledTimes(1);

    unmount();

    expect(h.uninstall).toHaveBeenCalledTimes(1);
  });

  it('hides the splash once it reports finished', async () => {
    render(<App />);
    await finishSplash();

    expect(screen.queryByTestId('splash')).toBeNull();
  });
});

describe('App first-run storage mode', () => {
  it('asks for the storage mode when none has been persisted', async () => {
    h.getSetting.mockResolvedValue(null);
    render(<App />);
    await finishSplash();

    await waitFor(() => expect(h.getSetting).toHaveBeenCalledWith('store_mode'));
    expect(screen.getByTestId('first-run')).toBeTruthy();
  });

  it('does not ask again when a mode is already stored', async () => {
    h.getSetting.mockResolvedValue('reference');
    render(<App />);
    await finishSplash();

    await waitFor(() => expect(h.getSetting).toHaveBeenCalled());
    expect(screen.queryByTestId('first-run')).toBeNull();
  });

  it('does not reopen the dialog when reading the setting fails', async () => {
    h.getSetting.mockRejectedValue(new Error('settings unavailable'));
    render(<App />);
    await finishSplash();

    await waitFor(() => expect(h.getSetting).toHaveBeenCalled());
    expect(screen.queryByTestId('first-run')).toBeNull();
  });

  it('persists the chosen mode and closes the dialog', async () => {
    h.getSetting.mockResolvedValue(null);
    render(<App />);
    await finishSplash();
    await waitFor(() => expect(screen.getByTestId('first-run')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'choose-reference' }));
    });

    expect(h.setSetting).toHaveBeenCalledWith('store_mode', 'reference');
    await waitFor(() => expect(screen.queryByTestId('first-run')).toBeNull());
  });

  it('keeps the dialog open when the choice could not be saved', async () => {
    h.getSetting.mockResolvedValue(null);
    h.setSetting.mockRejectedValue(new Error('disk full'));
    render(<App />);
    await finishSplash();
    await waitFor(() => expect(screen.getByTestId('first-run')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'choose-copy' }));
    });

    expect(h.setSetting).toHaveBeenCalledWith('store_mode', 'copy');
    expect(screen.getByTestId('first-run')).toBeTruthy();
  });
});

describe('App routing shell', () => {
  it('renders the active route inside the shell', () => {
    render(<App />);

    expect(screen.getByTestId('page-gallery')).toBeTruthy();
    expect(screen.getByTestId('sidebar').dataset.route).toBe('/gallery');
    expect(screen.getByTestId('command-palette').dataset.hasNav).toBe('true');
  });

  it('shows a not-found message for an unknown route', () => {
    h.routeDef = () => undefined as never;
    render(<App />);

    expect(screen.getByText('common.notFound')).toBeTruthy();
    expect(screen.queryByTestId('page-gallery')).toBeNull();
  });

  it('catches a crashing page behind the error boundary', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.routeDef = () =>
      ({
        path: '/gallery',
        component: () => {
          throw new Error('page exploded');
        },
      }) as never;

    render(<App />);

    expect(screen.getByRole('alert').textContent).toContain('page exploded');
    consoleError.mockRestore();
  });

  it('navigates from the sidebar and the mobile nav', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'nav-trash' }));
    expect(h.navigate).toHaveBeenCalledWith('/trash');

    h.isMobile.value = true;
    cleanup();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'mobile-tags' }));
    expect(h.navigate).toHaveBeenCalledWith('/tags');
  });

  it('uses the mobile shell on small screens', () => {
    h.isMobile.value = true;
    const { container } = render(<App />);

    expect(screen.queryByTestId('sidebar')).toBeNull();
    expect(screen.getByTestId('mobile-nav')).toBeTruthy();
    expect((container.querySelector('main') as HTMLElement).style.paddingBottom).toBe('56px');
  });

  it('opens the command palette from the sidebar search button', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'sidebar-search' }));

    expect(h.toggle).toHaveBeenCalledTimes(1);
  });

  it('registers a refresh command that reloads the gallery', () => {
    render(<App />);

    expect(h.routeCommands?.[0]).toBe(h.navigate);
    expect(h.globalShortcuts?.[0]).toBe(h.navigate);

    (h.routeCommands![1] as () => void)();

    expect(h.navigate).toHaveBeenCalledWith('/gallery');
    expect(h.fetchImages).toHaveBeenCalledWith(1);
  });

  it('jumps to search when an image-to-image search is triggered', () => {
    h.sourceImageId.value = 'img-1';
    render(<App />);

    expect(h.navigate).toHaveBeenCalledWith('/search');
    expect(h.clearSource).toHaveBeenCalledTimes(1);
  });
});

describe('App drag and drop', () => {
  it('imports dropped image files and jumps to the import page', async () => {
    render(<App />);

    await act(async () => {
      h.dragConfig!.onDrop(['C:/lib/fox.png', 'C:/lib/readme.txt']);
    });

    expect(h.navigate).toHaveBeenCalledWith('/import');
    h.route.value = '/import';
    cleanup();
    render(<App />);
    // A fresh render has no dropped paths; the drop state belongs to the instance.
    expect(screen.getByTestId('page-import').dataset.paths).toBe('');
  });

  it('keeps dropped directories but never unsupported files', async () => {
    h.isDirectory.mockImplementation(async (p: string) => p === 'C:/my-album');
    render(<App />);

    await act(async () => {
      h.dragConfig!.onDrop(['C:/my-album', 'C:/lib/readme.txt']);
    });

    expect(h.navigate).toHaveBeenCalledWith('/import');
    expect(h.isDirectory).toHaveBeenCalledWith('C:/my-album');
  });

  it('ignores a drop that contains nothing importable', async () => {
    render(<App />);

    await act(async () => {
      h.dragConfig!.onDrop(['C:/lib/readme.txt', 'C:/lib/song.mp3']);
    });

    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('passes the dropped paths to the import page and clears them once consumed', async () => {
    h.route.value = '/import';
    h.getSetting.mockResolvedValue('copy');
    const { container } = render(<App />);

    await act(async () => {
      h.dragConfig!.onDrop(['C:/lib/fox.png']);
    });

    await waitFor(() =>
      expect(container.querySelector('[data-testid="page-import"]')!.getAttribute('data-paths')).toBe(
        'C:/lib/fox.png',
      ),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'consume' }));
    });

    expect(container.querySelector('[data-testid="page-import"]')!.getAttribute('data-paths')).toBe('');
  });

  it('shows the drop overlay while a drag is in progress', () => {
    h.isDragging.value = true;
    render(<App />);

    expect(screen.getByTestId('drop-overlay').dataset.visible).toBe('true');
  });
});
