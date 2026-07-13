import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
}

// Global performance store
const globalMetrics = new Map<string, PerformanceMetrics>();

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).__LUMORA_PERF__ = {
    getMetrics: () => {
      const result: Record<string, PerformanceMetrics> = {};
      globalMetrics.forEach((value, key) => {
        result[key] = { ...value };
      });
      return result;
    },
    getReport: () => {
      const entries = Array.from(globalMetrics.entries())
        .map(([name, m]) => ({
          name,
          ...m,
          avgMs: m.averageRenderTime.toFixed(2),
          maxMs: m.maxRenderTime.toFixed(2),
          totalMs: m.totalRenderTime.toFixed(2),
        }))
        .sort((a, b) => b.averageRenderTime - a.averageRenderTime);

      console.table(entries.map(e => ({
        Component: e.name,
        'Renders': e.renderCount,
        'Avg (ms)': e.avgMs,
        'Max (ms)': e.maxMs,
        'Total (ms)': e.totalMs,
      })));
      return entries;
    },
    reset: () => {
      globalMetrics.clear();
      console.log('[Perf] Metrics reset');
    },
  };
}

export function usePerformanceMonitor(componentName: string) {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity,
  });

  const renderStartRef = useRef<number>(0);

  // Mark render start
  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  // Mark render end and calculate metrics
  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;
    const metrics = metricsRef.current;

    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
    metrics.maxRenderTime = Math.max(metrics.maxRenderTime, renderTime);
    metrics.minRenderTime = Math.min(metrics.minRenderTime, renderTime);

    // Update global store
    globalMetrics.set(componentName, { ...metrics });

    // Warn about slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(
        `[${componentName}] Slow render #${metrics.renderCount}: ${renderTime.toFixed(2)}ms (>16ms)`
      );
    }
  });

  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      totalRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
    };
    globalMetrics.delete(componentName);
  }, [componentName]);

  return { getMetrics, resetMetrics };
}
