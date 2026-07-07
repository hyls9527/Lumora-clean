import { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '../lib/tauri';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Convert file path to displayable src with automatic retry on failure.
 * Returns null while loading or on final failure.
 */
export function useImageSrc(filePath: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const filePathRef = useRef(filePath);

  // Reset on filePath change
  useEffect(() => {
    filePathRef.current = filePath;
    attemptRef.current = 0;
    setSrc(null);
  }, [filePath]);

  useEffect(() => {
    if (!filePath) return;

    let cancelled = false;

    const load = async () => {
      try {
        const result = await convertFileSrc(filePath);
        if (!cancelled) setSrc(result);
      } catch {
        if (!cancelled && attemptRef.current < MAX_RETRIES) {
          attemptRef.current += 1;
          // ponytail: simple retry with delay
          setTimeout(() => {
            if (!cancelled && filePathRef.current === filePath) {
              void load();
            }
          }, RETRY_DELAY_MS * attemptRef.current);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [filePath]);

  return src;
}
