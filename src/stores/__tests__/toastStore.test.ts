import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToastStore } from '../toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clearToasts();
  });

  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToastStore());
    expect(result.current.toasts).toEqual([]);
  });

  it('should add toast', () => {
    const { result } = renderHook(() => useToastStore());
    act(() => {
      result.current.addToast('success', 'Test message');
    });
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Test message');
  });

  it('should remove toast', () => {
    const { result } = renderHook(() => useToastStore());
    act(() => {
      result.current.addToast('success', 'Test message');
    });
    const toastId = result.current.toasts[0].id;
    act(() => {
      result.current.removeToast(toastId);
    });
    expect(result.current.toasts).toEqual([]);
  });

  it('should clear all toasts', () => {
    const { result } = renderHook(() => useToastStore());
    act(() => {
      result.current.addToast('success', 'Message 1');
      result.current.addToast('error', 'Message 2');
    });
    act(() => {
      result.current.clearToasts();
    });
    expect(result.current.toasts).toEqual([]);
  });
});
