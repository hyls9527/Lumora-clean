import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '../useSearchHistory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useSearchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.history).toEqual([]);
  });

  it('should add history item', () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addHistory('nature');
    });
    expect(result.current.history).toEqual(['nature']);
  });

  it('should remove duplicates', () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addHistory('nature');
      result.current.addHistory('portrait');
      result.current.addHistory('nature');
    });
    expect(result.current.history).toEqual(['nature', 'portrait']);
  });

  it('should limit history to 20 items', () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.addHistory(`query ${i}`);
      }
    });
    expect(result.current.history.length).toBe(20);
  });

  it('should remove history item', () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addHistory('nature');
      result.current.addHistory('portrait');
      result.current.removeHistory('nature');
    });
    expect(result.current.history).toEqual(['portrait']);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      result.current.addHistory('nature');
      result.current.addHistory('portrait');
      result.current.clearHistory();
    });
    expect(result.current.history).toEqual([]);
  });
});
