import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNav } from '../useKeyboardNav';
import type { KeyboardNavStage } from '../useKeyboardNav';

vi.mock('../../stores/commandStore', () => ({
  useCommandStore: () => false, // isCommandOpen = false
}));

/** Helper: dispatch a keydown event on window */
function pressKey(key: string, target?: HTMLElement) {
  const el = target ?? window;
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('useKeyboardNav', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Backward compatibility: single-stage ───
  describe('single stage (default behavior)', () => {
    it('should fire the first stage handlers when no activeStage given', () => {
      const onArrowDown = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onArrowDown }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('ArrowDown');
      expect(onArrowDown).toHaveBeenCalledTimes(1);
    });

    it('should fire Enter handler', () => {
      const onEnter = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onEnter }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('Enter');
      expect(onEnter).toHaveBeenCalledTimes(1);
    });

    it('should fire Escape handler', () => {
      const onEscape = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onEscape }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('Escape');
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('should fire onDelete for Delete key', () => {
      const onDelete = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onDelete }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('Delete');
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('should fire onDelete for Backspace key', () => {
      const onDelete = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onDelete }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('Backspace');
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('should fire onFavorite when f pressed', () => {
      const onFavorite = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onFavorite }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('f');
      expect(onFavorite).toHaveBeenCalledTimes(1);
    });

    it('should fire onRate with number when 1-5 pressed', () => {
      const onRate = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onRate }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('3');
      expect(onRate).toHaveBeenCalledWith(3);
    });

    it('should fire onSpace when Space pressed', () => {
      const onSpace = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onSpace }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey(' ');
      expect(onSpace).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Multi-stage switching ───
  describe('multi-stage switching', () => {
    it('should fire active stage handlers, not inactive ones', () => {
      const browseEnter = vi.fn();
      const detailEnter = vi.fn();

      const stages: KeyboardNavStage[] = [
        { id: 'browse', onEnter: browseEnter },
        { id: 'detail', onEnter: detailEnter },
      ];

      renderHook(() =>
        useKeyboardNav({ route: '/gallery', stages, activeStage: 'browse' }),
      );

      pressKey('Enter');
      expect(browseEnter).toHaveBeenCalledTimes(1);
      expect(detailEnter).not.toHaveBeenCalled();
    });

    it('should switch handlers when activeStage changes', () => {
      const browseEnter = vi.fn();
      const detailEnter = vi.fn();

      const stages: KeyboardNavStage[] = [
        { id: 'browse', onEnter: browseEnter },
        { id: 'detail', onEnter: detailEnter },
      ];

      const { rerender } = renderHook(
        ({ activeStage }) =>
          useKeyboardNav({ route: '/gallery', stages, activeStage }),
        { initialProps: { activeStage: 'browse' as string | undefined } },
      );

      pressKey('Enter');
      expect(browseEnter).toHaveBeenCalledTimes(1);

      rerender({ activeStage: 'detail' });

      pressKey('Enter');
      expect(browseEnter).toHaveBeenCalledTimes(1); // no more calls
      expect(detailEnter).toHaveBeenCalledTimes(1);
    });

    it('should resolve different keys per stage', () => {
      const browseArrowUp = vi.fn();
      const detailArrowLeft = vi.fn();

      const stages: KeyboardNavStage[] = [
        { id: 'browse', onArrowUp: browseArrowUp },
        { id: 'detail', onArrowLeft: detailArrowLeft },
      ];

      renderHook(() =>
        useKeyboardNav({ route: '/gallery', stages, activeStage: 'detail' }),
      );

      pressKey('ArrowLeft');
      expect(detailArrowLeft).toHaveBeenCalledTimes(1);

      pressKey('ArrowUp');
      // browse stage is not active, so ArrowUp should NOT fire
      expect(browseArrowUp).not.toHaveBeenCalled();
    });

    it('should default to first stage when activeStage is undefined', () => {
      const firstEnter = vi.fn();
      const secondEnter = vi.fn();

      const stages: KeyboardNavStage[] = [
        { id: 'first', onEnter: firstEnter },
        { id: 'second', onEnter: secondEnter },
      ];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      pressKey('Enter');
      expect(firstEnter).toHaveBeenCalledTimes(1);
      expect(secondEnter).not.toHaveBeenCalled();
    });
  });

  // ─── Edge cases ───
  describe('edge cases', () => {
    it('should do nothing when stages array is empty', () => {
      const stages: KeyboardNavStage[] = [];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      // Should not throw
      pressKey('Enter');
      pressKey('ArrowDown');
      pressKey('Escape');
    });

    it('should do nothing when activeStage does not match any stage', () => {
      const onEnter = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'browse', onEnter }];

      renderHook(() =>
        useKeyboardNav({
          route: '/gallery',
          stages,
          activeStage: 'nonexistent',
        }),
      );

      pressKey('Enter');
      expect(onEnter).not.toHaveBeenCalled();
    });

    it('should skip when disabled is true', () => {
      const onEnter = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onEnter }];

      renderHook(() =>
        useKeyboardNav({ route: '/gallery', stages, disabled: true }),
      );

      pressKey('Enter');
      expect(onEnter).not.toHaveBeenCalled();
    });

    it('should fire when disabled is false (explicit)', () => {
      const onEnter = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onEnter }];

      renderHook(() =>
        useKeyboardNav({ route: '/gallery', stages, disabled: false }),
      );

      pressKey('Enter');
      expect(onEnter).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Input exclusion ───
  describe('input exclusion', () => {
    it('should NOT fire when typing in INPUT', () => {
      const onArrowDown = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onArrowDown }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      const input = document.createElement('input');
      document.body.appendChild(input);
      pressKey('ArrowDown', input);
      document.body.removeChild(input);

      expect(onArrowDown).not.toHaveBeenCalled();
    });

    it('should NOT fire when typing in TEXTAREA', () => {
      const onEnter = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onEnter }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      pressKey('Enter', textarea);
      document.body.removeChild(textarea);

      expect(onEnter).not.toHaveBeenCalled();
    });

    it('should NOT fire when typing in SELECT', () => {
      const onArrowDown = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onArrowDown }];

      renderHook(() => useKeyboardNav({ route: '/gallery', stages }));

      const select = document.createElement('select');
      document.body.appendChild(select);
      pressKey('ArrowDown', select);
      document.body.removeChild(select);

      expect(onArrowDown).not.toHaveBeenCalled();
    });
  });

  // ─── Cleanup ───
  describe('cleanup', () => {
    it('should remove listener on unmount', () => {
      const onArrowDown = vi.fn();
      const stages: KeyboardNavStage[] = [{ id: 'main', onArrowDown }];

      const { unmount } = renderHook(() =>
        useKeyboardNav({ route: '/gallery', stages }),
      );

      unmount();
      pressKey('ArrowDown');
      expect(onArrowDown).not.toHaveBeenCalled();
    });
  });

  // ─── Real-world multi-stage scenario (Gallery-like) ───
  describe('gallery-like multi-stage scenario', () => {
    it('should handle browse → detail → browse transition', () => {
      const browseEnter = vi.fn();
      const detailEscape = vi.fn();
      const detailLeft = vi.fn();
      const detailRight = vi.fn();

      const stages: KeyboardNavStage[] = [
        { id: 'browse', onEnter: browseEnter },
        {
          id: 'detail',
          onEscape: detailEscape,
          onArrowLeft: detailLeft,
          onArrowRight: detailRight,
        },
      ];

      const { rerender } = renderHook(
        ({ activeStage }) =>
          useKeyboardNav({ route: '/gallery', stages, activeStage }),
        { initialProps: { activeStage: 'browse' as string | undefined } },
      );

      // Browse: Enter fires
      pressKey('Enter');
      expect(browseEnter).toHaveBeenCalledTimes(1);

      // Switch to detail
      rerender({ activeStage: 'detail' });

      // Detail: arrows fire, Escape fires
      pressKey('ArrowLeft');
      pressKey('ArrowRight');
      pressKey('Escape');
      expect(detailLeft).toHaveBeenCalledTimes(1);
      expect(detailRight).toHaveBeenCalledTimes(1);
      expect(detailEscape).toHaveBeenCalledTimes(1);

      // Switch back to browse
      rerender({ activeStage: 'browse' });

      pressKey('Enter');
      expect(browseEnter).toHaveBeenCalledTimes(2);
    });

    it('should allow partial handler overrides between stages', () => {
      const deleteBrowse = vi.fn();
      const deleteDetail = vi.fn();
      const favBrowse = vi.fn();

      const stages: KeyboardNavStage[] = [
        { id: 'browse', onDelete: deleteBrowse, onFavorite: favBrowse },
        // detail stage has onDelete but no onFavorite
        { id: 'detail', onDelete: deleteDetail },
      ];

      const { rerender } = renderHook(
        ({ activeStage }) =>
          useKeyboardNav({ route: '/gallery', stages, activeStage }),
        { initialProps: { activeStage: 'browse' as string | undefined } },
      );

      pressKey('Delete');
      pressKey('f');
      expect(deleteBrowse).toHaveBeenCalledTimes(1);
      expect(favBrowse).toHaveBeenCalledTimes(1);

      rerender({ activeStage: 'detail' });

      pressKey('Delete');
      pressKey('f');
      expect(deleteDetail).toHaveBeenCalledTimes(1);
      // f should not fire anything in detail stage (no handler)
      expect(favBrowse).toHaveBeenCalledTimes(1); // unchanged
    });
  });
});
