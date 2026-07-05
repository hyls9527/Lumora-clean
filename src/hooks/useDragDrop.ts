import { useEffect, useState } from 'react';

interface UseDragDropOptions {
  onDrop?: (paths: string[]) => void;
  onDragOver?: () => void;
  onDragLeave?: () => void;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Hook to handle file drag-and-drop events on the Tauri webview.
 * Returns `isDragging` state for UI feedback.
 * In browser/dev context, drag-and-drop events are ignored.
 */
export function useDragDrop({ onDrop, onDragOver, onDragLeave }: UseDragDropOptions = {}) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    let unlistenPromise: Promise<() => void> | null = null;
    let cancelled = false;

    import(/* @vite-ignore */ '@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) => {
        if (cancelled) return;
        const webview = getCurrentWebview();
        unlistenPromise = webview.onDragDropEvent((event) => {
          switch (event.payload.type) {
            case 'enter':
            case 'over':
              setIsDragging(true);
              onDragOver?.();
              break;

            case 'drop':
              setIsDragging(false);
              if (event.payload.paths && event.payload.paths.length > 0) {
                onDrop?.(event.payload.paths);
              }
              break;

            case 'leave':
              setIsDragging(false);
              onDragLeave?.();
              break;
          }
        });
      })
      .catch((err) => {
        console.error('Failed to load Tauri webview drag-and-drop:', err);
      });

    return () => {
      cancelled = true;
      if (unlistenPromise) {
        unlistenPromise.then((fn) => fn()).catch(() => {});
      }
    };
  }, [onDrop, onDragOver, onDragLeave]);

  return { isDragging };
}
