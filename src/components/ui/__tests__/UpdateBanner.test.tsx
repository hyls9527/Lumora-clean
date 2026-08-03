import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { UpdateBanner } from '../UpdateBanner';

// Mock useUpdater
const mockUseUpdater = vi.fn();
vi.mock('../../../hooks/useUpdater', () => ({
  useUpdater: () => mockUseUpdater(),
}));

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    checking: false,
    downloading: false,
    downloadProgress: null,
    installing: false,
    downloaded: false,
    dismissed: false,
    error: null,
    updateInfo: { version: '0.4.0', body: '' },
    downloadUpdate: vi.fn(),
    installNow: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  };
}

describe('UpdateBanner', () => {
  beforeEach(() => {
    mockUseUpdater.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render when no update available', () => {
    mockUseUpdater.mockReturnValue(makeState({ available: false }));

    render(<UpdateBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should not render while checking', () => {
    mockUseUpdater.mockReturnValue(makeState({ checking: true }));

    render(<UpdateBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show version when update available', () => {
    mockUseUpdater.mockReturnValue(makeState());

    render(<UpdateBanner />);
    expect(screen.getByText(/0\.4\.0/)).toBeDefined();
    expect(screen.getByText('下载更新')).toBeDefined();
  });

  it('should show release-notes preview when body is present', () => {
    mockUseUpdater.mockReturnValue(
      makeState({ updateInfo: { version: '0.4.0', body: '修复了若干问题\n新增语义搜索' } }),
    );

    render(<UpdateBanner />);
    expect(screen.getByText(/修复了若干问题/)).toBeDefined();
  });

  it('should show download progress', () => {
    mockUseUpdater.mockReturnValue(makeState({ downloading: true, downloadProgress: 42 }));

    render(<UpdateBanner />);
    expect(screen.getByText('正在下载 42%')).toBeDefined();
  });

  it('should call downloadUpdate on download button click', () => {
    const mockDownload = vi.fn();
    mockUseUpdater.mockReturnValue(makeState({ downloadUpdate: mockDownload }));

    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('下载更新'));
    expect(mockDownload).toHaveBeenCalled();
  });

  it('should show restart button when downloaded and call installNow', () => {
    const mockInstall = vi.fn();
    mockUseUpdater.mockReturnValue(makeState({ downloaded: true, installNow: mockInstall }));

    render(<UpdateBanner />);
    expect(screen.getByText(/更新已下载/)).toBeDefined();
    fireEvent.click(screen.getByText('重启并安装'));
    expect(mockInstall).toHaveBeenCalled();
  });

  it('should disable restart button during install', () => {
    mockUseUpdater.mockReturnValue(makeState({ downloaded: true, installing: true }));

    render(<UpdateBanner />);
    const btn = screen.getByText('安装中…') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should call dismiss on later button', () => {
    const mockDismiss = vi.fn();
    mockUseUpdater.mockReturnValue(makeState({ dismiss: mockDismiss }));

    render(<UpdateBanner />);
    fireEvent.click(screen.getByText('稍后'));
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('should not render when dismissed', () => {
    mockUseUpdater.mockReturnValue(makeState({ dismissed: true }));

    render(<UpdateBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show error message and retry label', () => {
    mockUseUpdater.mockReturnValue(makeState({ error: 'Download failed' }));

    render(<UpdateBanner />);
    expect(screen.getByText('Download failed')).toBeDefined();
    expect(screen.getByText('重试下载')).toBeDefined();
  });
});
