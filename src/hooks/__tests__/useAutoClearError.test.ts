import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { create } from 'zustand';
import { useAutoClearError } from '../useAutoClearError';

// Create a minimal test store with error field
function createTestStore() {
  return create<{ error: string | null; setError: (e: string | null) => void }>(
    (set) => ({
      error: null,
      setError: (error) => set({ error }),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoClearError', () => {
  it('clears error after timeout', async () => {
    const store = createTestStore();
    store.getState().setError('something broke');

    renderHook(() => useAutoClearError(store, 3000));

    expect(store.getState().error).toBe('something broke');

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(store.getState().error).toBeNull();
  });

  it('resets timer when error changes', async () => {
    const store = createTestStore();
    store.getState().setError('first error');

    renderHook(() => useAutoClearError(store, 3000));

    // After 2s, change error — timer should reset
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {
      store.getState().setError('second error');
    });

    // After another 2s (total 4s from start), error should still be there
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(store.getState().error).toBe('second error');

    // After 1 more second (3s from second error), error should clear
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(store.getState().error).toBeNull();
  });

  it('does nothing when error is null', async () => {
    const store = createTestStore();
    // error is null initially
    renderHook(() => useAutoClearError(store, 1000));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Still null, no crash
    expect(store.getState().error).toBeNull();
  });

  it('uses default 5000ms timeout', async () => {
    const store = createTestStore();
    store.getState().setError('slow error');

    renderHook(() => useAutoClearError(store));

    await act(async () => {
      vi.advanceTimersByTime(4999);
    });
    expect(store.getState().error).toBe('slow error');

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(store.getState().error).toBeNull();
  });
});
