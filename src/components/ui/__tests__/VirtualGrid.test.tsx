import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { VirtualGrid } from '../VirtualGrid';

// Mock ResizeObserver
const mockResizeObserver = vi.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.ResizeObserver = mockResizeObserver;

describe('VirtualGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const { container } = render(
      <VirtualGrid
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
        rowHeight={100}
      />
    );
    expect(container).toBeDefined();
  });

  it('should render visible items only', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const { container } = render(
      <VirtualGrid
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
        rowHeight={100}
        columnCount={4}
      />
    );
    // Should not render all 1000 items
    expect(container.querySelectorAll('div').length).toBeLessThan(1000);
  });

  it('should accept custom column count', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const { container } = render(
      <VirtualGrid
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
        rowHeight={100}
        columnCount={2}
      />
    );
    expect(container).toBeDefined();
  });
});
