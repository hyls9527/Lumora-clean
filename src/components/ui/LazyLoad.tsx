import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazyLoadProps {
  children: ReactNode;
  /** Placeholder height in px when not yet visible */
  height?: number;
  /** Root margin for entering viewport (pre-load distance) */
  enterMargin?: string;
  /** Root margin for leaving viewport (unload distance) */
  leaveMargin?: string;
}

/**
 * LazyLoad — renders children when visible, unmounts when far away.
 * Caps DOM nodes at ~3 viewport heights of content.
 */
export function LazyLoad({
  children,
  height = 200,
  enterMargin = '200px',
  leaveMargin = '1000px',
}: LazyLoadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'placeholder' | 'rendered' | 'exited'>('placeholder');
  const [renderedHeight, setRenderedHeight] = useState(height);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (state === 'placeholder') {
      // Wait for element to enter viewport
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setState('rendered');
            observer.disconnect();
          }
        },
        { rootMargin: enterMargin },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }

    if (state === 'rendered') {
      // Track when element leaves the extended viewport
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            // Capture height before unmounting
            if (el.offsetHeight > 0) {
              setRenderedHeight(el.offsetHeight);
            }
            setState('exited');
          }
        },
        { rootMargin: leaveMargin },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }

    if (state === 'exited') {
      // Wait for element to re-enter viewport
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setState('rendered');
            observer.disconnect();
          }
        },
        { rootMargin: enterMargin },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [state, enterMargin, leaveMargin]);

  if (state !== 'rendered') {
    return (
      <div
        ref={ref}
        style={{
          minHeight: renderedHeight,
          background: 'rgba(139, 115, 75, 0.04)',
          borderRadius: 2,
        }}
      />
    );
  }

  return <div ref={ref}>{children}</div>;
}
