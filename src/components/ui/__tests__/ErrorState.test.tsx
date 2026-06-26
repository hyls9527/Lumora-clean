import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorState } from '../ErrorState';

afterEach(() => {
  cleanup();
});

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState message="Something went wrong" />);

    expect(screen.getByText('出现错误')).toBeDefined();
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: '重试' });
    expect(retryButton).toBeDefined();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: '重试' });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });

  it('has correct error color style', () => {
    render(<ErrorState message="Error occurred" />);

    const errorTitle = screen.getByText('出现错误');
    // jsdom converts hex to rgb
    expect(errorTitle.style.color).toMatch(/#8b3030|rgb\(139, 48, 48\)/);
  });
});
