import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SearchPage } from '../SearchPage';

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
  useSemanticSearchStore: vi.fn((selector) => {
    const state = {
      results: [],
      loading: false,
      error: null,
      searchSemantic: vi.fn(),
      searchByImage: vi.fn(),
      clearResults: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
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
});
