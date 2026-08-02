import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resetModalStackForTests } from '../../lib/modalStack';
import { useModalEsc } from '../useModalEsc';

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

beforeEach(() => {
  resetModalStackForTests();
});

describe('useModalEsc', () => {
  it('closes the only open modal on Escape', () => {
    const onClose = vi.fn();
    renderHook(() => useModalEsc(true, onClose));

    act(() => pressEscape());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the topmost modal when multiple are open', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    renderHook(() => useModalEsc(true, closeA));
    renderHook(() => useModalEsc(true, closeB));

    act(() => pressEscape());

    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it('closes the lower modal after the top one unmounts', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    renderHook(() => useModalEsc(true, closeA));
    const { unmount } = renderHook(() => useModalEsc(true, closeB));
    unmount();

    act(() => pressEscape());

    expect(closeB).not.toHaveBeenCalled();
    expect(closeA).toHaveBeenCalledTimes(1);
  });

  it('does not register disabled modals', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    renderHook(() => useModalEsc(false, closeA));
    renderHook(() => useModalEsc(true, closeB));

    act(() => pressEscape());

    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it('stops responding after unmount', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useModalEsc(true, onClose));
    unmount();

    act(() => pressEscape());

    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus to the first focusable inside the root when opened', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    first.dataset.testid = 'first';
    const last = document.createElement('button');
    last.dataset.testid = 'last';
    container.append(first, last);
    document.body.appendChild(container);
    const ref = { current: container };

    renderHook(() => useModalEsc(true, vi.fn(), ref));

    expect(document.activeElement).toBe(first);

    container.remove();
  });

  it('wraps Tab focus within the root', () => {
    const container = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('button');
    container.append(first, last);
    document.body.appendChild(container);
    const ref = { current: container };

    renderHook(() => useModalEsc(true, vi.fn(), ref));

    last.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(first);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, shiftKey: true }),
      );
    });
    expect(document.activeElement).toBe(last);

    container.remove();
  });

  it('restores focus to the previously focused element on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const container = document.createElement('div');
    const inside = document.createElement('button');
    container.appendChild(inside);
    document.body.appendChild(container);
    const ref = { current: container };

    const { unmount } = renderHook(() => useModalEsc(true, vi.fn(), ref));

    expect(document.activeElement).not.toBe(trigger);
    unmount();
    expect(document.activeElement).toBe(trigger);

    container.remove();
    trigger.remove();
  });
});
