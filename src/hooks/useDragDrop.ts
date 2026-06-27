import { useEffect, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';

interface UseDragDropOptions {
  onDrop?: (paths: string[]) => void;
  onDragOver?: () => void;
  onDragLeave?: () => void;
}

/**
 * Hook to handle file drag-and-drop events on the Tauri webview.
 * Returns `isDragging` state for UI feedback.
 */
export function useDragDrop({ onDrop, onDragOver, onDragLeave }: UseDragDropOptions = {}) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const webview = getCurrentWebview();
    const unlisten = webview.onDragDropEvent((event) => {
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

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onDrop, onDragOver, onDragLeave]);

  return { isDragging };
}
