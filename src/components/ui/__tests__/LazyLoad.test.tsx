import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { LazyLoad } from '../LazyLoad';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
let observerCallback: IntersectionObserverCallback | null = null;

vi.stubGlobal(
  'IntersectionObserver',
  vi.fn((cb: IntersectionObserverCallback) => {
    observerCallback = cb;
    return { observe: mockObserve, disconnect: mockDisconnect, unobserve: vi.fn() };
  }),
);

beforeEach(() => {
  observerCallback = null;
  mockObserve.mockClear();
  mockDisconnect.mockClear();
});

describe('LazyLoad', () => {
  it('should render placeholder when not visible', () => {
    const { container } = render(
      <LazyLoad height={300}>
        <div>content</div>
      </LazyLoad>,
    );
    const placeholder = container.firstChild as HTMLElement;
    expect(placeholder.style.minHeight).toBe('300px');
    expect(container.textContent).not.toContain('content');
  });

  it('should render children when intersecting', () => {
    const { container } = render(
      <LazyLoad>
        <div>visible content</div>
      </LazyLoad>,
    );

    // Simulate entering viewport
    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(container.textContent).toContain('visible content');
  });

  it('should use default height of 200', () => {
    const { container } = render(
      <LazyLoad>
        <div>content</div>
      </LazyLoad>,
    );
    const placeholder = container.firstChild as HTMLElement;
    expect(placeholder.style.minHeight).toBe('200px');
  });
});
