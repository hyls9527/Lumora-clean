import { useState, useEffect } from 'react';
import { convertFileSrc } from '../lib/tauri';

export function useImageSrc(filePath: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) { setSrc(null); return; }
    let cancelled = false;
    convertFileSrc(filePath)
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [filePath]);

  return src;
}
