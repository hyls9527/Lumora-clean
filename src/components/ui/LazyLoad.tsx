import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazyLoadProps {
  children: ReactNode;
  /** Placeholder height in px when not yet visible */
  height?: number;
  /** Root margin for IntersectionObserver (pre-load distance) */
  rootMargin?: string;
}

/**
 * LazyLoad — renders children only when they enter the viewport.
 * Uses IntersectionObserver for efficient scroll-based loading.
 * Follows DESIGN.md: 200ms transition, no scale animations.
 */
export function LazyLoad({ children, height = 200, rootMargin = '200px' }: LazyLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (!isVisible) {
    return (
      <div
        ref={ref}
        style={{
          minHeight: height,
          background: 'rgba(139, 115, 75, 0.04)',
          borderRadius: 2,
        }}
      />
    );
  }

  return <>{children}</>;
}
