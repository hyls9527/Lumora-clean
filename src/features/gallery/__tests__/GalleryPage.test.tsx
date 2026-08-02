import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { GalleryPage } from '../GalleryPage';
import { useFilterStore } from '../../../stores/filterStore';

// Use vi.hoisted to create the mock before hoisted vi.mock calls
const mockUseKeyboardNav = vi.hoisted(() => vi.fn());
const mockFetchImages = vi.hoisted(() => vi.fn());

// Mock the store
vi.mock('../../../stores/imageStore', () => ({
  useImageStore: vi.fn((selector) => {
    const state = {
      filters: {
        mode: 'creator',
        view: 'grid',
        sortBy: 'time',
        modelFilter: 'all',
        searchQuery: '',
        searchField: 'all',
        searchMode: 'text',
        similarityThreshold: 70,
      },
      setSortBy: vi.fn(),
      setModelFilter: vi.fn(),
      setView: vi.fn(),
      getFilteredImages: () => [],
      loading: false,
      error: null,
      fetchImages: mockFetchImages,
      loadMore: vi.fn(),
      page: 1,
      total: 0,
      perPage: 40,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../hooks/useSelection', () => ({
  useSelection: () => ({
    selectedIds: new Set(),
    toggleSelect: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useImageActions', () => ({
  useImageActions: () => ({
    toggleFavorite: vi.fn(),
    setRating: vi.fn(),
  }),
}));

vi.mock('../../../stores/trashStore', () => ({
  useTrashStore: vi.fn((selector) => {
    const state = { softDeleteImage: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/imageSearchStore', () => ({
  useImageSearchStore: vi.fn((selector) => {
    const state = { sourceImageId: null, clearSource: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: vi.fn((selector) => {
    const state = { statusMap: {}, fetchStatus: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../lib/api/images', () => ({
  batchSoftDelete: vi.fn(),
}));

vi.mock('../../../lib/api/ai', () => ({
  batchAutoTag: vi.fn(),
}));

vi.mock('../../../hooks/useKeyboardNav', () => ({
  useKeyboardNav: mockUseKeyboardNav,
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

// Mock child components
vi.mock('../../../components/ui/ImageCard', () => ({
  ImageCard: () => <div data-testid="image-card" />,
}));

vi.mock('../../../components/ui/DetailModal', () => ({
  DetailModal: () => null,
}));

vi.mock('../../../components/ui/LoadingSkeleton', () => ({
  GridSkeleton: () => <div data-testid="loading-skeleton" />,
}));

vi.mock('../../../components/ui/ErrorState', () => ({
  ErrorState: ({ message }: { message: string }) => (
    <div data-testid="error-state">{message}</div>
  ),
}));

vi.mock('../../../components/ui/LazyLoad', () => ({
  LazyLoad: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/InfiniteScroll', () => ({
  InfiniteScroll: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/TabButton', () => ({
  TabButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('../BatchToolbar', () => ({
  BatchToolbar: () => null,
}));

describe('GalleryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFilterStore.setState({ criteria: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it('should render without crashing', () => {
    const { container } = render(<GalleryPage />);
    expect(container).toBeDefined();
  });

  it('renders the filter panel', () => {
    const { container } = render(<GalleryPage />);
    expect(container.textContent).toContain('filter.title');
  });

  it('refetches the gallery when filter criteria change', async () => {
    render(<GalleryPage />);
    mockFetchImages.mockClear();

    act(() => {
      useFilterStore.setState({ criteria: { model: 'flux' } });
    });

    await waitFor(
      () => {
        expect(mockFetchImages).toHaveBeenCalledWith(1);
      },
      { timeout: 2000 },
    );
  });

  describe('useKeyboardNav integration', () => {
    it('should call useKeyboardNav with multi-stage config', () => {
      render(<GalleryPage />);

      expect(mockUseKeyboardNav).toHaveBeenCalledTimes(1);

      const callArgs = mockUseKeyboardNav.mock.calls[0][0];
      expect(callArgs.route).toBe('/gallery');
      expect(callArgs.activeStage).toBe('browse'); // detailImage starts as null
      expect(callArgs.stages).toBeDefined();
      expect(callArgs.stages).toHaveLength(2);

      // Verify stage IDs
      const stageIds = callArgs.stages.map((s: { id: string }) => s.id);
      expect(stageIds).toEqual(['browse', 'detail']);

      // Verify browse stage has all handlers
      const browseStage = callArgs.stages[0];
      expect(browseStage.onArrowUp).toBeDefined();
      expect(browseStage.onArrowDown).toBeDefined();
      expect(browseStage.onArrowLeft).toBeDefined();
      expect(browseStage.onArrowRight).toBeDefined();
      expect(browseStage.onEnter).toBeDefined();
      expect(browseStage.onSpace).toBeDefined();
      expect(browseStage.onEscape).toBeDefined();
      expect(browseStage.onDelete).toBeDefined();
      expect(browseStage.onFavorite).toBeDefined();
      expect(browseStage.onRate).toBeDefined();

      // Verify detail stage has relevant handlers
      const detailStage = callArgs.stages[1];
      expect(detailStage.onArrowLeft).toBeDefined();
      expect(detailStage.onArrowRight).toBeDefined();
      expect(detailStage.onEscape).toBeDefined();
      expect(detailStage.onDelete).toBeDefined();
      expect(detailStage.onFavorite).toBeDefined();
      expect(detailStage.onRate).toBeDefined();
    });
  });
});
