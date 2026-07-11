import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { InfiniteScroll } from '../InfiniteScroll';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

describe('InfiniteScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <InfiniteScroll onLoadMore={vi.fn()} hasMore={false} loading={false}>
        <div>Content</div>
      </InfiniteScroll>
    );
    expect(container).toBeDefined();
  });

  it('should render children', () => {
    const { container } = render(
      <InfiniteScroll onLoadMore={vi.fn()} hasMore={false} loading={false}>
        <div>Test Content</div>
      </InfiniteScroll>
    );
    expect(container.textContent).toContain('Test Content');
  });
});
