import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
}));

vi.mock('../../../components/ui/ErrorState', () => ({
  ErrorState: () => <div data-testid="error-state" />,
}));

vi.mock('../SearchAdvancedSettings', () => ({
  SearchAdvancedSettings: () => <div data-testid="advanced-settings" />,
}));

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
});
