import { useEffect, useRef, useCallback } from 'react';
import { t } from '../../lib/tokens';

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  children: React.ReactNode;
  threshold?: number;
}

/**
 * InfiniteScroll — loads more items when user scrolls near bottom.
 * Uses IntersectionObserver for efficient scroll detection.
 */
export function InfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  children,
  threshold = 200,
}: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: `${threshold}px`,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect, threshold]);

  return (
    <>
      {children}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '24px 0',
            color: t.textMuted,
            fontFamily: t.fontBody,
            fontSize: 13,
          }}
        >
          加载中…
        </div>
      )}
    </>
  );
}
