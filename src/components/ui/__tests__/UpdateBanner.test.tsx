import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { UpdateBanner } from '../UpdateBanner';

// Mock useUpdater
const mockUseUpdater = vi.fn();
vi.mock('../../../hooks/useUpdater', () => ({
  useUpdater: () => mockUseUpdater(),
}));

describe('UpdateBanner', () => {
  beforeEach(() => {
    mockUseUpdater.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render when no update available', () => {
    mockUseUpdater.mockReturnValue({
      available: false,
      checking: false,
      installing: false,
      downloaded: false,
      error: null,
      updateInfo: null,
      installUpdate: vi.fn(),
    });

    render(<UpdateBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show version when update available', () => {
    mockUseUpdater.mockReturnValue({
      available: true,
      checking: false,
      installing: false,
      downloaded: false,
      error: null,
      updateInfo: { version: '0.4.0', body: '' },
      installUpdate: vi.fn(),
    });

    render(<UpdateBanner />);
    expect(screen.getByText(/0\.4\.0/)).toBeDefined();
    expect(screen.getByText('更新并重启')).toBeDefined();
  });

  it('should call installUpdate on button click', () => {
    const mockInstall = vi.fn();
    mockUseUpdater.mockReturnValue({
      available: true,
      checking: false,
      installing: false,
      downloaded: false,
      error: null,
      updateInfo: { version: '0.4.0' },
      installUpdate: mockInstall,
    });

    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('更新并重启'));
    expect(mockInstall).toHaveBeenCalled();
  });

  it('should disable button during install', () => {
    mockUseUpdater.mockReturnValue({
      available: true,
      checking: false,
      installing: true,
      downloaded: false,
      error: null,
      updateInfo: { version: '0.4.0' },
      installUpdate: vi.fn(),
    });

    render(<UpdateBanner />);
    const btn = screen.getByText('安装中…') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should show error message', () => {
    mockUseUpdater.mockReturnValue({
      available: true,
      checking: false,
      installing: false,
      downloaded: false,
      error: 'Download failed',
      updateInfo: { version: '0.4.0' },
      installUpdate: vi.fn(),
    });

    render(<UpdateBanner />);
    expect(screen.getByText('Download failed')).toBeDefined();
  });
});
