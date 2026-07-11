import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTouchGesture } from '../useTouchGesture';

describe('useTouchGesture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useTouchGesture());
    expect(result.current.isSwiping).toBe(false);
    expect(result.current.isLongPressing).toBe(false);
    expect(result.current.swipeDirection.horizontal).toBeNull();
    expect(result.current.swipeDirection.vertical).toBeNull();
  });

  it('should accept options', () => {
    const options = {
      onSwipe: vi.fn(),
      onLongPress: vi.fn(),
      onDoubleTap: vi.fn(),
      swipeThreshold: 100,
      longPressDelay: 1000,
      doubleTapDelay: 500,
    };
    const { result } = renderHook(() => useTouchGesture(options));
    expect(result.current).toBeDefined();
  });
});
