import { useEffect } from 'react';
import { useCommandStore } from '../stores/commandStore';

export type PageRoute = '/gallery' | '/search' | '/tags' | '/trash' | string;

interface KeyboardNavOptions {
  route: PageRoute;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onDelete?: () => void;
  onFavorite?: () => void;
  onRate?: (rating: number) => void;
}

export function useKeyboardNav({
  route,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onEnter,
  onSpace,
  onEscape,
  onDelete,
  onFavorite,
  onRate,
}: KeyboardNavOptions) {
  const isCommandOpen = useCommandStore((s) => s.isOpen);

  useEffect(() => {
    // Only gallery page has full keyboard nav
    if (route !== '/gallery') return;

    const handler = (e: KeyboardEvent) => {
      // Command palette open → skip all shortcuts
      if (isCommandOpen) return;

      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onArrowRight?.();
          break;
        case 'Enter':
          e.preventDefault();
          onEnter?.();
          break;
        case ' ':
          e.preventDefault();
          onSpace?.();
          break;
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          onDelete?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          onFavorite?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          e.preventDefault();
          onRate?.(Number(e.key));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [route, isCommandOpen, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter, onSpace, onEscape, onDelete, onFavorite, onRate]);
}
