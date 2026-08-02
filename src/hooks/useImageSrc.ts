import { useState, useEffect, useRef } from 'react';
import { convertFileSrc, invoke } from '../lib/tauri';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

/** Derive a usable MIME type from the file name, falling back safely. */
function mimeForPath(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  return MIME_BY_EXT[ext] ?? (ext ? `image/${ext}` : 'image/png');
}

interface UseImageSrcOptions {
  /** If set, load a thumbnail resized to this max width (pixels). */
  thumbnailMaxWidth?: number;
}

/**
 * Convert file path to displayable src.
 * Strategy: try base64 command first (works without asset protocol),
 * fall back to convertFileSrc (asset protocol).
 *
 * Pass `thumbnailMaxWidth` to get a resized thumbnail instead of the full image.
 */
export function useImageSrc(
  filePath: string | null,
  options?: UseImageSrcOptions,
): string | null {
  const [src, setSrc] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const filePathRef = useRef(filePath);
  const optionsRef = useRef(options);
  optionsRef.current = options;

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
      const opts = optionsRef.current;
      const isThumbnail = !!opts?.thumbnailMaxWidth;

      try {
        // Strategy 1: base64 command (no asset protocol needed)
        const cmd = isThumbnail
          ? 'get_thumbnail_base64_cmd'
          : 'get_image_base64_cmd';
        const args = isThumbnail
          ? { filePath, maxWidth: opts!.thumbnailMaxWidth }
          : { filePath };

        const b64 = await invoke<string>(cmd, args);
        if (!cancelled && b64) {
          setSrc(`data:${mimeForPath(filePath)};base64,${b64}`);
          return;
        }
      } catch {
        // Strategy 2: asset protocol fallback (full-size only)
        if (!isThumbnail) {
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
      }

      // Retry with exponential backoff
      if (!cancelled && attemptRef.current < MAX_RETRIES) {
        attemptRef.current += 1;
        const delay = BASE_DELAY_MS * Math.pow(2, attemptRef.current - 1);
        setTimeout(() => {
          if (!cancelled && filePathRef.current === filePath) {
            void load();
          }
        }, delay);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [filePath]);

  return src;
}
