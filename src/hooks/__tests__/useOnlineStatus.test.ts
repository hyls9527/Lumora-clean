import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '../useOnlineStatus';

const originalNavigatorOnLine = navigator.onLine;

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    configurable: true,
    value,
  });
}

beforeEach(() => {
  setNavigatorOnLine(true);
});

afterEach(() => {
  setNavigatorOnLine(originalNavigatorOnLine);
});

describe('useOnlineStatus', () => {
  it('should return isOnline=true when navigator.onLine is true', () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('should return isOnline=false when navigator.onLine is false', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('should react to offline event', () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should react to online event', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('should recheck navigator.onLine', () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);

    setNavigatorOnLine(false);

    act(() => {
      result.current.recheck();
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should not listen to events when enabled=false', () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnlineStatus({ enabled: false }));

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Should still be true because events are ignored
    expect(result.current.isOnline).toBe(true);
  });

  it('should return recheck as a stable function reference', () => {
    const { result, rerender } = renderHook(() => useOnlineStatus());
    const recheck1 = result.current.recheck;

    rerender();

    expect(result.current.recheck).toBe(recheck1);
  });

  it('should default isOnline to true when navigator is unavailable (SSR safety)', () => {
    const navBackup = (globalThis as any).navigator;
    delete (globalThis as any).navigator;

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);

    (globalThis as any).navigator = navBackup;
  });
});
