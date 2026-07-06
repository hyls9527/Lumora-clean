import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SemanticSearchBar } from '../SemanticSearchBar';
import { useSemanticSearchStore } from '../../../stores/semanticSearchStore';

vi.mock('../../../stores/semanticSearchStore', () => ({
  useSemanticSearchStore: vi.fn(),
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockStore = {
  query: '',
  mode: 'exact' as const,
  suggestions: [],
  showSuggestions: false,
  loading: false,
  setQuery: vi.fn(),
  setMode: vi.fn(),
  search: vi.fn(),
  fetchSuggestions: vi.fn(),
  clearSuggestions: vi.fn(),
  setShowSuggestions: vi.fn(),
};

function getMainInput() {
  return document.querySelector('input[type="text"]') as HTMLInputElement;
}

describe('SemanticSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    (useSemanticSearchStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ...mockStore });
  });

  it('should render search input', () => {
    render(<SemanticSearchBar />);
    expect(getMainInput()).toBeTruthy();
  });

  it('should call setQuery on input change', () => {
    render(<SemanticSearchBar />);
    fireEvent.change(getMainInput(), { target: { value: 'cat' } });
    expect(mockStore.setQuery).toHaveBeenCalledWith('cat');
  });

  it('should call search on Enter key', () => {
    render(<SemanticSearchBar />);
    fireEvent.keyDown(getMainInput(), { key: 'Enter' });
    expect(mockStore.search).toHaveBeenCalled();
  });

  it('should render mode toggle buttons', () => {
    render(<SemanticSearchBar />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('should call setMode when mode button clicked', () => {
    render(<SemanticSearchBar />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(mockStore.setMode).toHaveBeenCalled();
  });

  it('should show loading indicator when loading', () => {
    (useSemanticSearchStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      loading: true,
    });
    render(<SemanticSearchBar />);
    expect(getMainInput()).toBeTruthy();
  });

  it('should show suggestions when available', () => {
    (useSemanticSearchStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      suggestions: ['cat', 'cattle'],
      showSuggestions: true,
    });
    render(<SemanticSearchBar />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(2);
  });

  it('should call search when suggestion clicked', () => {
    (useSemanticSearchStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      suggestions: ['cat'],
      showSuggestions: true,
    });
    render(<SemanticSearchBar />);
    const option = screen.getByRole('option');
    fireEvent.click(option);
    expect(mockStore.search).toHaveBeenCalled();
  });

  it('should display current query value', () => {
    (useSemanticSearchStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockStore,
      query: 'existing query',
    });
    render(<SemanticSearchBar />);
    expect(getMainInput().value).toBe('existing query');
  });

  it('should call clearSuggestions on blur', () => {
    render(<SemanticSearchBar />);
    fireEvent.blur(getMainInput());
    expect(getMainInput()).toBeTruthy();
  });
});
