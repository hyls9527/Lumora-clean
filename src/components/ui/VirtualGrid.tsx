import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  columnCount?: number;
  rowHeight: number;
  gap?: number;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export function VirtualGrid<T>({
  items,
  renderItem,
  columnCount = 4,
  rowHeight,
  gap = 12,
  overscan = 5,
  onLoadMore,
  hasMore = false,
  loading = false,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate layout
  const { totalRows, startIndex, endIndex } = useMemo(() => {
    const totalRows = Math.ceil(items.length / columnCount);
    const rowHeightWithGap = rowHeight + gap;
    const visibleRows = Math.ceil(containerHeight / rowHeightWithGap);
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeightWithGap) - overscan);
    const endIndex = Math.min(totalRows, startIndex + visibleRows + overscan * 2);

    return { totalRows, startIndex, endIndex };
  }, [items.length, columnCount, rowHeight, gap, overscan, scrollTop, containerHeight]);

  // Get visible items
  const visibleItems = useMemo(() => {
    const start = startIndex * columnCount;
    const end = Math.min(items.length, endIndex * columnCount);
    return items.slice(start, end).map((item, i) => ({
      item,
      index: start + i,
      row: Math.floor((start + i) / columnCount),
      col: (start + i) % columnCount,
    }));
  }, [items, startIndex, endIndex, columnCount]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
    setScrollTop(scrollTop);

    // Load more when near bottom
    if (hasMore && !loading && scrollTop + clientHeight >= scrollHeight - 100) {
      onLoadMore?.();
    }
  }, [hasMore, loading, onLoadMore]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Total height for scrollbar
  const totalHeight = totalRows * (rowHeight + gap);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, row, col }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: row * (rowHeight + gap),
              left: `${(col / columnCount) * 100}%`,
              width: `${(1 / columnCount) * 100}%`,
              height: rowHeight,
              padding: `0 ${gap / 2}px`,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
      {loading && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          Loading...
        </div>
      )}
    </div>
  );
}
