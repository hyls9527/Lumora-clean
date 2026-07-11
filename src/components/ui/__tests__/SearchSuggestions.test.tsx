import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SearchSuggestions } from '../SearchSuggestions';

describe('SearchSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <SearchSuggestions
        query=""
        suggestions={['nature', 'portrait', 'landscape']}
        onSelect={vi.fn()}
        visible={true}
      />
    );
    expect(container).toBeDefined();
  });

  it('should render suggestions', () => {
    const { container } = render(
      <SearchSuggestions
        query=""
        suggestions={['nature', 'portrait', 'landscape']}
        onSelect={vi.fn()}
        visible={true}
      />
    );
    expect(container.textContent).toContain('nature');
    expect(container.textContent).toContain('portrait');
    expect(container.textContent).toContain('landscape');
  });

  it('should not render when visible is false', () => {
    const { container } = render(
      <SearchSuggestions
        query=""
        suggestions={['nature', 'portrait']}
        onSelect={vi.fn()}
        visible={false}
      />
    );
    expect(container.textContent).not.toContain('nature');
  });

  it('should filter suggestions based on query', () => {
    const { container } = render(
      <SearchSuggestions
        query="nat"
        suggestions={['nature', 'portrait', 'landscape']}
        onSelect={vi.fn()}
        visible={true}
      />
    );
    expect(container.textContent).toContain('nature');
    expect(container.textContent).not.toContain('portrait');
  });

  it('should call onSelect when clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <SearchSuggestions
        query=""
        suggestions={['nature', 'portrait']}
        onSelect={onSelect}
        visible={true}
      />
    );
    const items = container.querySelectorAll('[data-suggestion]');
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledWith('nature');
  });
});
