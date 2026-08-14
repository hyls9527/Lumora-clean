import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SplashScreen } from '../SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the brand mark and wordmark', () => {
    render(<SplashScreen ready={false} onFinish={vi.fn()} />);
    expect(screen.getByText('LUMORA')).toBeTruthy();
    expect(screen.getByText('光之韵律')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('does not finish before the minimum duration even when ready', () => {
    const onFinish = vi.fn();
    render(<SplashScreen ready onFinish={onFinish} />);
    vi.advanceTimersByTime(1399);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('finishes after the minimum duration when ready', () => {
    const onFinish = vi.fn();
    render(<SplashScreen ready onFinish={onFinish} />);
    vi.advanceTimersByTime(1400);
    expect(onFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('forces finish at the maximum duration even when not ready', () => {
    const onFinish = vi.fn();
    render(<SplashScreen ready={false} onFinish={onFinish} />);
    vi.advanceTimersByTime(5000);
    expect(onFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
