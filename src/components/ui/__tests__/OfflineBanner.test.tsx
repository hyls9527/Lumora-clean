import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';

// Mock useOnlineStatus
const mockUseOnlineStatus = vi.fn();
vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockUseOnlineStatus.mockReset();
  mockUseOnlineStatus.mockReturnValue({ isOnline: true, recheck: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('OfflineBanner', () => {
  it('should not render when online', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: true, recheck: vi.fn() });

    render(<OfflineBanner />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should render after 1.5s delay when offline', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });

    render(<OfflineBanner />);

    // Not visible immediately
    expect(screen.queryByRole('alert')).toBeNull();

    // Advance past the 1.5s delay
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('should not show banner if connection restored before delay', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });

    const { rerender } = render(<OfflineBanner />);

    // Before delay elapses, restore connectivity
    mockUseOnlineStatus.mockReturnValue({ isOnline: true, recheck: vi.fn() });
    rerender(<OfflineBanner />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should dismiss when "知道了" button is clicked', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });

    render(<OfflineBanner />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const dismissBtn = screen.getByText('知道了');
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should auto-hide when connectivity restored', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });

    const { rerender } = render(<OfflineBanner />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('alert')).toBeDefined();

    // Connectivity restored
    mockUseOnlineStatus.mockReturnValue({ isOnline: true, recheck: vi.fn() });
    rerender(<OfflineBanner />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should re-show after going offline again following a reconnect', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });

    const { rerender } = render(<OfflineBanner />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('alert')).toBeDefined();

    // Reconnect
    mockUseOnlineStatus.mockReturnValue({ isOnline: true, recheck: vi.fn() });
    rerender(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();

    // Go offline again
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });
    rerender(<OfflineBanner />);

    expect(screen.queryByRole('alert')).toBeNull(); // still within delay

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('should have role="alert" for accessibility', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });

    render(<OfflineBanner />);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole('alert')).toBeDefined();
  });
});
