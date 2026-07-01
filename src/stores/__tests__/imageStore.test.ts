import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImageStore } from '../imageStore';
import type { ImageRecord } from '../../types/image';

vi.mock('../../lib/api/images', () => ({
  toggleFavorite: vi.fn().mockResolvedValue(undefined),
  updateRating: vi.fn().mockResolvedValue(undefined),
  listImages: vi.fn(),
  searchImages: vi.fn(),
  importImages: vi.fn(),
  exportImages: vi.fn(),
  getImageTags: vi.fn(),
  addTagToImage: vi.fn(),
  removeTagFromImage: vi.fn(),
}));

import * as api from '../../lib/api/images';

function makeImage(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    id: '1',
    filePath: '/img/test.png',
    fileName: 'test.png',
    fileSizeKb: 100,
    width: 512,
    height: 512,
    format: 'png',
    createdAt: '2026-01-01T00:00:00Z',
    rating: 0,
    favorite: false,
    model: 'flux',
    prompt: 'a cat',
    tags: ['animal'],
    ...overrides,
  };
}

beforeEach(() => {
  useImageStore.setState({
    images: [],
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
    selectedIds: new Set<string>(),
    loading: false,
    error: null,
    page: 1,
    total: 0,
    perPage: 40,
    imageTags: {},
  });
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// toggleFavorite
// ---------------------------------------------------------------------------
describe('toggleFavorite', () => {
  it('flips favorite from false to true', () => {
    useImageStore.setState({ images: [makeImage({ id: 'a', favorite: false })] });
    useImageStore.getState().toggleFavorite('a');
    expect(useImageStore.getState().images[0].favorite).toBe(true);
  });

  it('flips favorite from true to false', () => {
    useImageStore.setState({ images: [makeImage({ id: 'a', favorite: true })] });
    useImageStore.getState().toggleFavorite('a');
    expect(useImageStore.getState().images[0].favorite).toBe(false);
  });

  it('calls api.toggleFavorite with the id', () => {
    useImageStore.setState({ images: [makeImage({ id: 'a' })] });
    useImageStore.getState().toggleFavorite('a');
    expect(api.toggleFavorite).toHaveBeenCalledWith('a');
  });
});

// ---------------------------------------------------------------------------
// setRating
// ---------------------------------------------------------------------------
describe('setRating', () => {
  it('sets rating optimistically', () => {
    useImageStore.setState({ images: [makeImage({ id: 'a', rating: 0 })] });
    useImageStore.getState().setRating('a', 4);
    expect(useImageStore.getState().images[0].rating).toBe(4);
  });

  it('calls api.updateRating with id and rating', () => {
    useImageStore.setState({ images: [makeImage({ id: 'a' })] });
    useImageStore.getState().setRating('a', 3);
    expect(api.updateRating).toHaveBeenCalledWith('a', 3);
  });

  it('does not change other images', () => {
    useImageStore.setState({
      images: [makeImage({ id: 'a', rating: 1 }), makeImage({ id: 'b', rating: 2 })],
    });
    useImageStore.getState().setRating('a', 5);
    expect(useImageStore.getState().images[1].rating).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// toggleSelect
// ---------------------------------------------------------------------------
describe('toggleSelect', () => {
  it('adds id when not selected', () => {
    useImageStore.setState({ selectedIds: new Set() });
    useImageStore.getState().toggleSelect('a');
    expect(useImageStore.getState().selectedIds.has('a')).toBe(true);
  });

  it('removes id when already selected', () => {
    useImageStore.setState({ selectedIds: new Set(['a']) });
    useImageStore.getState().toggleSelect('a');
    expect(useImageStore.getState().selectedIds.has('a')).toBe(false);
  });

  it('can select multiple ids independently', () => {
    useImageStore.setState({ selectedIds: new Set() });
    useImageStore.getState().toggleSelect('a');
    useImageStore.getState().toggleSelect('b');
    const sel = useImageStore.getState().selectedIds;
    expect(sel.has('a')).toBe(true);
    expect(sel.has('b')).toBe(true);
    expect(sel.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// selectAll
// ---------------------------------------------------------------------------
describe('selectAll', () => {
  it('selects all image ids', () => {
    useImageStore.setState({
      images: [makeImage({ id: 'a' }), makeImage({ id: 'b' }), makeImage({ id: 'c' })],
    });
    useImageStore.getState().selectAll();
    const sel = useImageStore.getState().selectedIds;
    expect(sel.size).toBe(3);
    expect(sel.has('a')).toBe(true);
    expect(sel.has('b')).toBe(true);
    expect(sel.has('c')).toBe(true);
  });

  it('produces empty set when no images', () => {
    useImageStore.setState({ images: [] });
    useImageStore.getState().selectAll();
    expect(useImageStore.getState().selectedIds.size).toBe(0);
  });

  it('replaces previous selection', () => {
    useImageStore.setState({
      images: [makeImage({ id: 'a' })],
      selectedIds: new Set(['old']),
    });
    useImageStore.getState().selectAll();
    expect(useImageStore.getState().selectedIds.has('old')).toBe(false);
    expect(useImageStore.getState().selectedIds.has('a')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearSelection
// ---------------------------------------------------------------------------
describe('clearSelection', () => {
  it('empties the set', () => {
    useImageStore.setState({ selectedIds: new Set(['a', 'b']) });
    useImageStore.getState().clearSelection();
    expect(useImageStore.getState().selectedIds.size).toBe(0);
  });

  it('is safe on already empty set', () => {
    useImageStore.setState({ selectedIds: new Set() });
    useImageStore.getState().clearSelection();
    expect(useImageStore.getState().selectedIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setMode / setView / setSortBy / setModelFilter / setSearchQuery
// ---------------------------------------------------------------------------
describe('filter setters', () => {
  it('setMode updates filters.mode', () => {
    useImageStore.getState().setMode('normal');
    expect(useImageStore.getState().filters.mode).toBe('normal');
  });

  it('setView updates filters.view', () => {
    useImageStore.getState().setView('list');
    expect(useImageStore.getState().filters.view).toBe('list');
  });

  it('setSortBy updates filters.sortBy', () => {
    useImageStore.getState().setSortBy('rating');
    expect(useImageStore.getState().filters.sortBy).toBe('rating');
  });

  it('setModelFilter updates filters.modelFilter', () => {
    useImageStore.getState().setModelFilter('dall-e');
    expect(useImageStore.getState().filters.modelFilter).toBe('dall-e');
  });

  it('setSearchQuery updates filters.searchQuery', () => {
    useImageStore.getState().setSearchQuery('hello');
    expect(useImageStore.getState().filters.searchQuery).toBe('hello');
  });

  it('each setter only changes its own field', () => {
    useImageStore.getState().setMode('normal');
    useImageStore.getState().setView('list');
    useImageStore.getState().setSortBy('size');
    const f = useImageStore.getState().filters;
    expect(f.mode).toBe('normal');
    expect(f.view).toBe('list');
    expect(f.sortBy).toBe('size');
    // others unchanged
    expect(f.modelFilter).toBe('all');
    expect(f.searchQuery).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getFilteredImages
// ---------------------------------------------------------------------------
describe('getFilteredImages', () => {
  it('returns all images when modelFilter is "all"', () => {
    useImageStore.setState({
      images: [makeImage({ id: 'a', model: 'flux' }), makeImage({ id: 'b', model: 'dall-e' })],
    });
    expect(useImageStore.getState().getFilteredImages()).toHaveLength(2);
  });

  it('filters by modelFilter case-insensitively', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', model: 'Flux' }),
        makeImage({ id: 'b', model: 'dall-e' }),
      ],
      filters: { ...useImageStore.getState().filters, modelFilter: 'flux' },
    });
    const result = useImageStore.getState().getFilteredImages();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('sorts by rating descending', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', rating: 1, createdAt: '2026-01-01' }),
        makeImage({ id: 'b', rating: 5, createdAt: '2026-01-02' }),
      ],
      filters: { ...useImageStore.getState().filters, sortBy: 'rating' },
    });
    const result = useImageStore.getState().getFilteredImages();
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('sorts by time descending (lexicographic)', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', createdAt: '2026-01-01' }),
        makeImage({ id: 'b', createdAt: '2026-06-01' }),
      ],
      filters: { ...useImageStore.getState().filters, sortBy: 'time' },
    });
    const result = useImageStore.getState().getFilteredImages();
    expect(result[0].id).toBe('b');
  });

  it('sorts by model alphabetically', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', model: 'flux' }),
        makeImage({ id: 'b', model: 'dall-e' }),
      ],
      filters: { ...useImageStore.getState().filters, sortBy: 'model' },
    });
    const result = useImageStore.getState().getFilteredImages();
    expect(result[0].model).toBe('dall-e');
  });

  it('sorts by size descending', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', fileSizeKb: 10 }),
        makeImage({ id: 'b', fileSizeKb: 999 }),
      ],
      filters: { ...useImageStore.getState().filters, sortBy: 'size' },
    });
    const result = useImageStore.getState().getFilteredImages();
    expect(result[0].id).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// getSearchResults
// ---------------------------------------------------------------------------
describe('getSearchResults', () => {
  it('returns empty when searchQuery is blank', () => {
    useImageStore.setState({
      images: [makeImage({ id: 'a', prompt: 'cat' })],
      filters: { ...useImageStore.getState().filters, searchQuery: '' },
    });
    expect(useImageStore.getState().getSearchResults()).toEqual([]);
  });

  it('matches prompt case-insensitively', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', prompt: 'A Beautiful Cat', tags: [] }),
        makeImage({ id: 'b', prompt: 'a dog', tags: [] }),
      ],
      filters: { ...useImageStore.getState().filters, searchQuery: 'cat' },
    });
    const result = useImageStore.getState().getSearchResults();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('matches tags case-insensitively', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', prompt: '', tags: ['Nature'] }),
        makeImage({ id: 'b', prompt: '', tags: ['city'] }),
      ],
      filters: { ...useImageStore.getState().filters, searchQuery: 'nature' },
    });
    const result = useImageStore.getState().getSearchResults();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('sorts by similarity descending', () => {
    useImageStore.setState({
      images: [
        makeImage({ id: 'a', prompt: 'cat', similarity: 60 }),
        makeImage({ id: 'b', prompt: 'cat', similarity: 95 }),
      ],
      filters: { ...useImageStore.getState().filters, searchQuery: 'cat' },
    });
    const result = useImageStore.getState().getSearchResults();
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });
});
