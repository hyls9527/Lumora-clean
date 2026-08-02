import { useEffect, useRef, type RefObject } from 'react';
import { registerModal, unregisterModal, isTopModal } from '../lib/modalStack';

/**
 * Closes this modal on Escape, but only when it is the topmost open modal.
 * `enabled=false` keeps the modal out of the stack entirely.
 *
 * When `rootRef` is provided, the modal also traps Tab focus inside the root
 * (again only while topmost) and restores focus to the previously focused
 * element when it closes.
 */
export function useModalEsc(
  enabled: boolean,
  onClose: () => void,
  rootRef?: RefObject<HTMLElement | null>,
): void {
  const idRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const id = registerModal();
    idRef.current = id;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () => {
      const root = rootRef?.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
    };

    const handler = (e: KeyboardEvent) => {
      if (!isTopModal(id)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler, true);

    // Move focus into the dialog when it opens (unless focus is already inside).
    const els = focusables();
    if (els.length > 0 && !rootRef?.current?.contains(document.activeElement)) {
      els[0].focus();
    }

    return () => {
      unregisterModal(id);
      window.removeEventListener('keydown', handler, true);
      idRef.current = null;
      previouslyFocused?.focus?.();
    };
  }, [enabled, rootRef]);
}
