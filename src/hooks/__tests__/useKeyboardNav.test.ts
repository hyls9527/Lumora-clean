import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNav } from '../useKeyboardNav';

vi.mock('../../stores/commandStore', () => ({
  useCommandStore: () => false, // isCommandOpen = false
}));

describe('useKeyboardNav', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call onArrowDown when ArrowDown pressed', () => {
    const onArrowDown = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onArrowDown }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(onArrowDown).toHaveBeenCalledTimes(1);
  });

  it('should call onEnter when Enter pressed', () => {
    const onEnter = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onEnter }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('should call onEscape when Escape pressed', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onEscape }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when Delete pressed', () => {
    const onDelete = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onDelete }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when Backspace pressed', () => {
    const onDelete = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onDelete }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('should call onFavorite when f pressed', () => {
    const onFavorite = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onFavorite }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    expect(onFavorite).toHaveBeenCalledTimes(1);
  });

  it('should call onRate with number when 1-5 pressed', () => {
    const onRate = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onRate }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('should call onSpace when Space pressed', () => {
    const onSpace = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onSpace }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onSpace).toHaveBeenCalledTimes(1);
  });

  it('should NOT call handler when typing in INPUT', () => {
    const onArrowDown = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onArrowDown }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    document.body.removeChild(input);

    expect(onArrowDown).not.toHaveBeenCalled();
  });

  it('should NOT call handler when typing in TEXTAREA', () => {
    const onEnter = vi.fn();
    renderHook(() => useKeyboardNav({ route: '/gallery', onEnter }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.body.removeChild(textarea);

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('should cleanup listener on unmount', () => {
    const onArrowDown = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNav({ route: '/gallery', onArrowDown }));

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(onArrowDown).not.toHaveBeenCalled();
  });
});
