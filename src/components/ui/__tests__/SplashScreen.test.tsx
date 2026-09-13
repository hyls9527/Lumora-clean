import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SplashScreen } from '../SplashScreen';

// Must match SplashScreen constants
const MIN_MS = 1800;
const MAX_MS = 5200;
const FADE_MS = 360;

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
    vi.advanceTimersByTime(MIN_MS - 1);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('finishes after the minimum duration when ready', () => {
    const onFinish = vi.fn();
    render(<SplashScreen ready onFinish={onFinish} />);
    vi.advanceTimersByTime(MIN_MS);
    expect(onFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FADE_MS);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('forces finish at the maximum duration even when not ready', () => {
    const onFinish = vi.fn();
    render(<SplashScreen ready={false} onFinish={onFinish} />);
    vi.advanceTimersByTime(MAX_MS);
    expect(onFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FADE_MS);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
