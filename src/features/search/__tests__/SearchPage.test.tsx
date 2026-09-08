import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SearchPage } from '../SearchPage';

const { semanticStoreMock, embeddingStoreMock } = vi.hoisted(() => ({
  semanticStoreMock: vi.fn((selector: unknown) => {
    const state = {
      mode: 'text',
      results: [],
      loading: false,
      error: null,
      searchSemantic: vi.fn(),
      searchByImage: vi.fn(),
      clearResults: vi.fn(),
    };
    return selector ? (selector as (s: unknown) => unknown)(state) : state;
  }),
  embeddingStoreMock: vi.fn((selector: unknown) => {
    const state = {
      stats: null,
      clipStats: null,
      statsLoading: false,
      filling: false,
      clipFilling: false,
      fillProgress: null,
      clipFillProgress: null,
      fetchStats: vi.fn(),
      fetchClipStats: vi.fn(),
      fillAllMissing: vi.fn(),
    };
    return selector ? (selector as (s: unknown) => unknown)(state) : state;
  }),
}));

// Mock stores
vi.mock('../../../stores/imageSearchStore', () => ({
  useImageSearchStore: vi.fn((selector) => {
    const state = {
      sourceImageId: null,
      clearSource: vi.fn(),
      results: [],
      loading: false,
      error: null,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/imageStore', () => ({
  useImageStore: vi.fn((selector) => {
    const state = {
      images: [],
      filters: {
        searchQuery: '',
        searchField: 'all',
        searchMode: 'text',
        similarityThreshold: 70,
      },
      setSearchQuery: vi.fn(),
      setSearchField: vi.fn(),
      setSearchMode: vi.fn(),
      setSimilarityThreshold: vi.fn(),
      searchImages: vi.fn(),
      getSearchResults: () => [],
      loading: false,
      error: null,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/semanticSearchStore', () => ({
  useSemanticSearchStore: semanticStoreMock,
}));

vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: embeddingStoreMock,
}));

// The result cards resolve full records by id via this API (F-1/F-4).
vi.mock('../../../lib/api/images', () => ({
  getImagesByIds: vi.fn(),
}));

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

// Mock components
vi.mock('../../../components/ui/SemanticSearchBar', () => ({
  SemanticSearchBar: () => <div data-testid="semantic-search-bar" />,
}));

vi.mock('../../../components/ui/ImageCard', () => ({
  ImageCard: () => <div data-testid="image-card" />,
}));

vi.mock('../../../components/ui/DetailModal', () => ({
  DetailModal: () => null,
}));

vi.mock('../../../components/ui/LoadingSkeleton', () => ({
  GridSkeleton: () => <div data-testid="loading-skeleton" />,
  SearchSkeleton: () => <div data-testid="loading-skeleton" />,
}));

vi.mock('../../../components/ui/ErrorState', () => ({
  ErrorState: () => <div data-testid="error-state" />,
}));

vi.mock('../../../components/ui/SimilarityBadge', () => ({
  SimilarityBadge: ({ value }: { value: number }) => (
    <span data-testid="similarity-badge">{value}</span>
  ),
}));

vi.mock('../../../hooks/useImageSrc', () => ({
  useImageSrc: () => null,
}));

vi.mock('../SearchAdvancedSettings', () => ({
  SearchAdvancedSettings: () => <div data-testid="advanced-settings" />,
}));

function withSemanticResults(results: Array<{ id: string; similarity: number }>) {
  semanticStoreMock.mockImplementation((selector: unknown) => {
    const state = {
      mode: 'semantic',
      results,
      loading: false,
      error: null,
      searchSemantic: vi.fn(),
      searchByImage: vi.fn(),
      clearResults: vi.fn(),
    };
    return selector ? (selector as (s: unknown) => unknown)(state) : state;
  });
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<SearchPage />);
    expect(container).toBeDefined();
  });

  it('shows an index-completeness hint in semantic mode', () => {
    semanticStoreMock.mockImplementation((selector: unknown) => {
      const state = {
        mode: 'semantic',
        results: [],
        loading: false,
        error: null,
        searchSemantic: vi.fn(),
        searchByImage: vi.fn(),
        clearResults: vi.fn(),
      };
      return selector ? (selector as (s: unknown) => unknown)(state) : state;
    });
    embeddingStoreMock.mockImplementation((selector: unknown) => {
      const state = {
        stats: { embedded: 8, pending: 0, error: 0, total: 10, missing: 2 },
        clipStats: null,
        statsLoading: false,
        filling: false,
        clipFilling: false,
        fillProgress: null,
        clipFillProgress: null,
        fetchStats: vi.fn(),
        fetchClipStats: vi.fn(),
        fillAllMissing: vi.fn(),
      };
      return selector ? (selector as (s: unknown) => unknown)(state) : state;
    });

    render(<SearchPage />);

    expect(screen.getByText('indexIncomplete')).toBeTruthy();
    expect(screen.getByText('fillMissing')).toBeTruthy();
  });

  it('renders semantic result cards resolved by id from the backend (F-1/F-4)', async () => {
    const { getImagesByIds } = await import('../../../lib/api/images');
    withSemanticResults([
      { id: 'sem-1', similarity: 87 },
      { id: 'sem-2', similarity: 73 },
    ]);
    (getImagesByIds as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'sem-1',
        filePath: '/a.png',
        fileName: 'a.png',
        fileSizeKb: 1,
        width: 10,
        height: 10,
        format: 'png',
        createdAt: '2025-01-01',
        rating: 0,
        favorite: false,
        model: 'sdxl',
        prompt: 'a sunset',
        tags: [],
        similarity: 87,
      },
      {
        id: 'sem-2',
        filePath: '/b.png',
        fileName: 'b.png',
        fileSizeKb: 1,
        width: 10,
        height: 10,
        format: 'png',
        createdAt: '2025-01-01',
        rating: 0,
        favorite: false,
        model: 'sdxl',
        prompt: 'a night',
        tags: [],
        similarity: 73,
      },
    ]);

    render(<SearchPage />);

    // The old code rendered nothing here: semanticSearchStore.results had no
    // consumer, and the image-to-image card looked only at the current
    // gallery page (≤40 items) — result ids off-page vanished (F-1/F-4).
    await waitFor(() => {
      expect(screen.getByText(/a sunset/)).toBeTruthy();
      expect(screen.getByText(/a night/)).toBeTruthy();
    });
    expect(screen.getAllByTestId('similarity-badge').length).toBe(2);
  });
});
