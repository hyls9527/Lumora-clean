import { useState, useEffect, useCallback, useRef } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface SwipeDirection {
  horizontal: 'left' | 'right' | null;
  vertical: 'up' | 'down' | null;
}

interface TouchGestureOptions {
  onSwipe?: (direction: SwipeDirection) => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

interface TouchGestureState {
  isSwiping: boolean;
  isLongPressing: boolean;
  swipeDirection: SwipeDirection;
}

export function useTouchGesture(options: TouchGestureOptions = {}) {
  const {
    onSwipe,
    onLongPress,
    onDoubleTap,
    swipeThreshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = options;

  const [state, setState] = useState<TouchGestureState>({
    isSwiping: false,
    isLongPressing: false,
    swipeDirection: { horizontal: null, vertical: null },
  });

  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef<number>(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };
    touchEnd.current = null;

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setState(prev => ({ ...prev, isLongPressing: true }));
      onLongPress?.();
    }, longPressDelay);
  }, [longPressDelay, onLongPress]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.touches[0];
    touchEnd.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };

    // Cancel long press if moved
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Calculate swipe direction
    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;

    const horizontal = Math.abs(deltaX) > swipeThreshold
      ? (deltaX > 0 ? 'right' : 'left')
      : null;
    const vertical = Math.abs(deltaY) > swipeThreshold
      ? (deltaY > 0 ? 'down' : 'up')
      : null;

    setState(prev => ({
      ...prev,
      isSwiping: horizontal !== null || vertical !== null,
      swipeDirection: { horizontal, vertical },
    }));
  }, [swipeThreshold]);

  const handleTouchEnd = useCallback(() => {
    // Cancel long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Check for double tap
    const now = Date.now();
    if (now - lastTapTime.current < doubleTapDelay) {
      onDoubleTap?.();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }

    // Trigger swipe callback
    if (state.isSwiping && onSwipe) {
      onSwipe(state.swipeDirection);
    }

    // Reset state
    setState({
      isSwiping: false,
      isLongPressing: false,
      swipeDirection: { horizontal: null, vertical: null },
    });

    touchStart.current = null;
    touchEnd.current = null;
  }, [state, onSwipe, onDoubleTap, doubleTapDelay]);

  useEffect(() => {
    const element = document;
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return state;
}
