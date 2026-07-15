import { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '../lib/tauri';
import { invoke } from '../lib/tauri';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Convert file path to displayable src.
 * Strategy: try base64 command first (works without asset protocol),
 * fall back to convertFileSrc (asset protocol).
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
        // Strategy 1: base64 command (no asset protocol needed)
        const b64 = await invoke<string>('get_image_base64_cmd', { filePath });
        if (!cancelled && b64) {
          const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png';
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          setSrc(`data:${mime};base64,${b64}`);
          return;
        }
      } catch {
        // Strategy 2: asset protocol fallback
        try {
          const result = await convertFileSrc(filePath);
          if (!cancelled) {
            setSrc(result);
            return;
          }
        } catch {
          // both failed
        }
      }

      // Retry on failure
      if (!cancelled && attemptRef.current < MAX_RETRIES) {
        attemptRef.current += 1;
        setTimeout(() => {
          if (!cancelled && filePathRef.current === filePath) {
            void load();
          }
        }, RETRY_DELAY_MS * attemptRef.current);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [filePath]);

  return src;
}
