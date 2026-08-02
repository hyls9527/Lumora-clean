import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile } from '../useMediaQuery';

const changeListeners = new Map<string, (e: { matches: boolean }) => void>();

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_type: string, cb: (e: { matches: boolean }) => void) => {
      changeListeners.set(query, cb);
    }),
    removeEventListener: vi.fn(() => {
      changeListeners.delete(query);
    }),
    dispatchEvent: vi.fn(() => false),
  }));
}

beforeEach(() => {
  changeListeners.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMediaQuery', () => {
  it('returns the initial match value', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query state changes', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'));
    expect(result.current).toBe(false);

    act(() => {
      changeListeners.get('(max-width: 640px)')?.({ matches: true });
    });
    expect(result.current).toBe(true);
  });

  it('removes its listener on unmount', () => {
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener,
      dispatchEvent: vi.fn(() => false),
    }));

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 800px)'));
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });
});

describe('useIsMobile', () => {
  it('is true when the viewport is at most 640px', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('is false on wider viewports', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
