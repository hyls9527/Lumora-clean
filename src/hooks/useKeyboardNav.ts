import { useEffect, useRef } from 'react';
import { useCommandStore } from '../stores/commandStore';

export type PageRoute = '/gallery' | '/search' | '/tags' | '/trash' | string;

/** One stage of keyboard handlers. A stage represents a UI mode (browse, detail, etc). */
export interface KeyboardNavStage {
  /** Unique identifier for this stage */
  id: string;
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

interface KeyboardNavOptions {
  route: PageRoute;
  /** Multiple stages of keyboard handlers. The active stage determines which handlers fire. */
  stages: KeyboardNavStage[];
  /** ID of the currently active stage. Defaults to the first stage's id if omitted. */
  activeStage?: string;
  /** When true, keyboard nav is completely disabled. */
  disabled?: boolean;
}

/**
 * Multi-stage keyboard navigation hook.
 *
 * Define multiple stages (e.g. "browse" and "detail") each with their own handlers.
 * Switch between them by changing `activeStage`. Only the active stage's handlers fire.
 */
export function useKeyboardNav({
  route: _route,
  stages,
  activeStage,
  disabled = false,
}: KeyboardNavOptions) {
  const isCommandOpen = useCommandStore((s) => s.isOpen);

  // Refs to avoid re-registering the listener on every callback change
  const isCommandOpenRef = useRef(isCommandOpen);
  const stagesRef = useRef(stages);
  const activeStageRef = useRef(activeStage);
  const disabledRef = useRef(disabled);

  isCommandOpenRef.current = isCommandOpen;
  stagesRef.current = stages;
  activeStageRef.current = activeStage;
  disabledRef.current = disabled;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Command palette open → skip all shortcuts
      if (isCommandOpenRef.current) return;

      // Explicitly disabled → skip
      if (disabledRef.current) return;

      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Resolve active stage: explicit activeStage → first stage's id → none
      const currentStageId = activeStageRef.current ?? stagesRef.current[0]?.id;
      if (!currentStageId) return;

      const stage = stagesRef.current.find((s) => s.id === currentStageId);
      if (!stage) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          stage.onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          stage.onArrowDown?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stage.onArrowLeft?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stage.onArrowRight?.();
          break;
        case 'Enter':
          e.preventDefault();
          stage.onEnter?.();
          break;
        case ' ':
          e.preventDefault();
          stage.onSpace?.();
          break;
        case 'Escape':
          e.preventDefault();
          stage.onEscape?.();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          stage.onDelete?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          stage.onFavorite?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          e.preventDefault();
          stage.onRate?.(Number(e.key));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // Listener registered once; refs keep values fresh
}
