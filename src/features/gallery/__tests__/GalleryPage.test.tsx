import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GalleryPage } from '../GalleryPage';

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
      fetchImages: vi.fn(),
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
  useKeyboardNav: vi.fn(),
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
  TabButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

vi.mock('../BatchToolbar', () => ({
  BatchToolbar: () => null,
}));

describe('GalleryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<GalleryPage />);
    expect(container).toBeDefined();
  });
});
