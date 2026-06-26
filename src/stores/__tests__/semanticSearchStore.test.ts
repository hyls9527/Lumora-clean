import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API layer
vi.mock('../../lib/api/semantic', () => ({
  searchSemantic: vi.fn(),
  getSearchSuggestions: vi.fn(),
}));

import { useSemanticSearchStore } from '../semanticSearchStore';
import * as api from '../../lib/api/semantic';

const mockSearch = vi.mocked(api.searchSemantic);
const mockSuggestions = vi.mocked(api.getSearchSuggestions);

beforeEach(() => {
  vi.clearAllMocks();
  useSemanticSearchStore.setState({
    query: '',
    mode: 'semantic',
    results: [],
    suggestions: [],
    loading: false,
    suggestionsLoading: false,
    error: null,
    showSuggestions: false,
  });
});

describe('setQuery', () => {
  it('updates query', () => {
    useSemanticSearchStore.getState().setQuery('hello');
    expect(useSemanticSearchStore.getState().query).toBe('hello');
  });
});

describe('setMode', () => {
  it('updates mode', () => {
    useSemanticSearchStore.getState().setMode('exact');
    expect(useSemanticSearchStore.getState().mode).toBe('exact');
  });
});

describe('search', () => {
  it('performs semantic search and stores results', async () => {
    const results = [
      { id: 'img-1', similarity: 95 },
      { id: 'img-2', similarity: 80 },
    ];
    mockSearch.mockResolvedValue(results);

    await useSemanticSearchStore.getState().search('mountain');

    expect(mockSearch).toHaveBeenCalledWith('mountain');
    expect(useSemanticSearchStore.getState().results).toEqual(results);
    expect(useSemanticSearchStore.getState().loading).toBe(false);
    expect(useSemanticSearchStore.getState().showSuggestions).toBe(false);
  });

  it('clears results for empty query', async () => {
    useSemanticSearchStore.setState({ results: [{ id: 'old', similarity: 50 }] });

    await useSemanticSearchStore.getState().search('');

    expect(useSemanticSearchStore.getState().results).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('uses override query when provided', async () => {
    useSemanticSearchStore.setState({ query: 'original' });
    mockSearch.mockResolvedValue([]);

    await useSemanticSearchStore.getState().search('override');

    expect(mockSearch).toHaveBeenCalledWith('override');
  });

  it('handles search error', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'));

    await useSemanticSearchStore.getState().search('test');

    expect(useSemanticSearchStore.getState().error).toBe('Network error');
    expect(useSemanticSearchStore.getState().loading).toBe(false);
  });
});

describe('fetchSuggestions', () => {
  it('fetches and stores suggestions', async () => {
    mockSuggestions.mockResolvedValue(['suggestion1', 'suggestion2']);

    await useSemanticSearchStore.getState().fetchSuggestions('test');

    expect(useSemanticSearchStore.getState().suggestions).toEqual(['suggestion1', 'suggestion2']);
    expect(useSemanticSearchStore.getState().showSuggestions).toBe(true);
    expect(useSemanticSearchStore.getState().suggestionsLoading).toBe(false);
  });

  it('clears suggestions for empty query', async () => {
    useSemanticSearchStore.setState({ suggestions: ['old'] });

    await useSemanticSearchStore.getState().fetchSuggestions('');

    expect(useSemanticSearchStore.getState().suggestions).toEqual([]);
    expect(mockSuggestions).not.toHaveBeenCalled();
  });

  it('hides suggestions when none returned', async () => {
    mockSuggestions.mockResolvedValue([]);

    await useSemanticSearchStore.getState().fetchSuggestions('test');

    expect(useSemanticSearchStore.getState().showSuggestions).toBe(false);
  });
});

describe('clearSuggestions', () => {
  it('clears suggestions and hides dropdown', () => {
    useSemanticSearchStore.setState({ suggestions: ['a', 'b'], showSuggestions: true });

    useSemanticSearchStore.getState().clearSuggestions();

    expect(useSemanticSearchStore.getState().suggestions).toEqual([]);
    expect(useSemanticSearchStore.getState().showSuggestions).toBe(false);
  });
});

describe('reset', () => {
  it('resets all state to defaults', () => {
    useSemanticSearchStore.setState({
      query: 'test',
      results: [{ id: 'img-1', similarity: 90 }],
      suggestions: ['a'],
      loading: true,
      error: 'some error',
    });

    useSemanticSearchStore.getState().reset();

    const state = useSemanticSearchStore.getState();
    expect(state.query).toBe('');
    expect(state.results).toEqual([]);
    expect(state.suggestions).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.showSuggestions).toBe(false);
  });
});
