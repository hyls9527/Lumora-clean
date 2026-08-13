import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { ImportPage } from '../ImportPage';

// Mock dependencies
const mockImportImages = vi.fn();

const { embeddingStoreMock } = vi.hoisted(() => ({
  embeddingStoreMock: vi.fn((selector: unknown) => {
    const state = {
      filling: false,
      clipFilling: false,
      fillProgress: null,
      clipFillProgress: null,
      fillAllMissing: vi.fn(),
    };
    return selector ? (selector as (s: unknown) => unknown)(state) : state;
  }),
}));

vi.mock('../../../stores/imageStore', () => ({
  useImageStore: () => ({
    loading: false,
    error: null,
    importImages: mockImportImages,
  }),
}));

vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: embeddingStoreMock,
}));

vi.mock('../../../lib/api/embeddings', () => ({
  getEmbeddingStats: vi.fn(),
  getClipEmbeddingStats: vi.fn(),
}));

vi.mock('../../../lib/api/aesthetic', () => ({
  scoreMissing: vi.fn().mockResolvedValue({ processed: 0, remaining: 0 }),
}));

import * as embeddingsApi from '../../../lib/api/embeddings';
import * as aestheticApi from '../../../lib/api/aesthetic';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../lib/tokens', () => ({
  t: {
    bg: '#fff',
    text: '#000',
    textSecondary: '#666',
    textMuted: '#999',
    accent: '#8b734b',
    border: 'rgba(139,115,75,0.1)',
    fontDisplay: 'serif',
    fontBody: 'sans-serif',
    danger: '#c0392b',
    success: '#27ae60',
  },
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}));

vi.mock('../../../components/ui/ErrorState', () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div data-testid="error-state">
      <span>{message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

vi.mock('../../../components/ui/Collapsible', () => ({
  Collapsible: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="collapsible">
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../ImportComponents', () => ({
  StatCard: ({ label }: { label: string }) => <div>{label}</div>,
  StatusBadge: ({ status }: { status: string }) => <div>{status}</div>,
  SectionHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SettingRow: ({ label }: { label: string }) => <div>{label}</div>,
  Toggle: () => <div />,
  inputStyle: {},
  selectStyle: {},
}));

describe('ImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImportImages.mockResolvedValue({
      imported: 5,
      skipped: 2,
      totalScanned: 7,
      items: [],
    });
  });

  it('renders page title', () => {
    render(<ImportPage />);
    expect(screen.getByText('导入管理')).toBeTruthy();
  });

  it('shows import buttons', () => {
    render(<ImportPage />);
    const folderButtons = screen.getAllByText(/选择文件夹/);
    expect(folderButtons.length).toBeGreaterThan(0);
    const fileButtons = screen.getAllByText(/选择文件/);
    expect(fileButtons.length).toBeGreaterThan(0);
  });

  it('shows drop zone instruction', () => {
    render(<ImportPage />);
    const dropText = screen.getAllByText(/拖拽文件夹到此处/);
    expect(dropText.length).toBeGreaterThan(0);
  });

  it('calls importImages when droppedPaths provided', async () => {
    await act(async () => {
      render(<ImportPage droppedPaths={['C:\\photos\\test.png']} onPathsConsumed={vi.fn()} />);
    });
    expect(mockImportImages).toHaveBeenCalled();
  });

  it('calls onPathsConsumed after import', async () => {
    const onPathsConsumed = vi.fn();
    await act(async () => {
      render(<ImportPage droppedPaths={['C:\\photos\\test.png']} onPathsConsumed={onPathsConsumed} />);
    });
    expect(onPathsConsumed).toHaveBeenCalled();
  });

  it('shows import result after successful import', async () => {
    mockImportImages.mockResolvedValue({
      imported: 3,
      skipped: 1,
      totalScanned: 4,
      items: [],
    });

    await act(async () => {
      render(<ImportPage droppedPaths={['C:\\photos\\test.png']} onPathsConsumed={vi.fn()} />);
    });

    const resultText = screen.getAllByText(/导入完成/);
    expect(resultText.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/新增/).length).toBeGreaterThan(0);
    expect(screen.getByText(/共扫描 4 个文件/)).toBeTruthy();
  });

  it('does not call importImages when droppedPaths is empty', () => {
    render(<ImportPage droppedPaths={[]} onPathsConsumed={vi.fn()} />);
    expect(mockImportImages).not.toHaveBeenCalled();
    expect(aestheticApi.scoreMissing).not.toHaveBeenCalled();
  });

  it('does not call importImages when droppedPaths is undefined', () => {
    render(<ImportPage />);
    expect(mockImportImages).not.toHaveBeenCalled();
  });

  it('triggers aesthetic judgment after a successful import', async () => {
    mockImportImages.mockResolvedValue({
      imported: 4,
      skipped: 0,
      totalScanned: 4,
      items: [],
    });

    await act(async () => {
      render(<ImportPage droppedPaths={['C:\\photos\\test.png']} onPathsConsumed={vi.fn()} />);
    });

    expect(aestheticApi.scoreMissing).toHaveBeenCalledWith(4);
  });

  it('prompts to build the semantic index after a successful import', async () => {
    vi.mocked(embeddingsApi.getEmbeddingStats).mockResolvedValue({
      embedded: 0,
      pending: 0,
      error: 0,
      total: 3,
      missing: 3,
    });
    vi.mocked(embeddingsApi.getClipEmbeddingStats).mockResolvedValue({
      embedded: 0,
      error: 0,
      total: 3,
      missing: 0,
    });
    const fillAllMissing = vi.fn();
    embeddingStoreMock.mockImplementation((selector: unknown) => {
      const state = {
        filling: false,
        clipFilling: false,
        fillProgress: null,
        clipFillProgress: null,
        fillAllMissing,
      };
      return selector ? (selector as (s: unknown) => unknown)(state) : state;
    });

    render(<ImportPage droppedPaths={['C:/tmp/img.png']} onPathsConsumed={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText(/还有 3 张图片未建立语义索引/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('补齐索引'));
    expect(fillAllMissing).toHaveBeenCalledTimes(1);
  });
});
