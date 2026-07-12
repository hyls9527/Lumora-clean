import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePerformanceMonitor } from '../usePerformance';

describe('usePerformanceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide getMetrics function', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));
    expect(typeof result.current.getMetrics).toBe('function');
  });

  it('should provide resetMetrics function', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));
    expect(typeof result.current.resetMetrics).toBe('function');
  });

  it('should track render count', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));
    const metrics = result.current.getMetrics();
    expect(metrics.renderCount).toBeGreaterThan(0);
  });

  it('should reset metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor('TestComponent'));
    result.current.resetMetrics();
    const metrics = result.current.getMetrics();
    expect(metrics.renderCount).toBe(0);
  });
});
