import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
}

export function usePerformanceMonitor(componentName: string) {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
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

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${componentName}] Render #${metrics.renderCount}: ${renderTime.toFixed(2)}ms`);
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
    };
  }, []);

  return { getMetrics, resetMetrics };
}
