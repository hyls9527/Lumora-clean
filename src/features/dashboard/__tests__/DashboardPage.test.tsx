import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';

const { embeddingStoreMock } = vi.hoisted(() => ({
  embeddingStoreMock: vi.fn((selector: unknown) => {
    const state = {
      stats: { embedded: 50, pending: 30, error: 20, total: 100, missing: 0 },
      statsLoading: false,
      filling: false,
      fillProgress: null,
      fetchStats: vi.fn(),
      fillMissing: vi.fn(),
    };
    return selector ? (selector as (s: unknown) => unknown)(state) : state;
  }),
}));

import * as api from '../../../lib/api/images';

// Mock the API layer
vi.mock('../../../lib/api/images', () => ({
  // Never-resolving promise: the mount fetch must not schedule a state
  // update after the test environment is torn down (CI teardown race).
  getDashboardStats: vi.fn(() => new Promise(() => {})),
  toImageRecord: (r: unknown) => r,
}));

// Mock the store
vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: embeddingStoreMock,
}));

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

// Mock format
vi.mock('../../../lib/format', () => ({
  formatFileSize: (kb: number) => `${(kb / 1024).toFixed(1)} MB`,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render without crashing', () => {
    const { container } = render(<DashboardPage />);
    expect(container).toBeDefined();
  });

  it('shows missing count and fills embeddings on demand', async () => {
    vi.mocked(api.getDashboardStats).mockResolvedValue({
      totalImages: 100,
      totalSizeKb: 500000,
      formatCounts: [],
      ratingCounts: [],
      topTags: [],
      recentImports: [],
    });
    const fillMissing = vi.fn();
    embeddingStoreMock.mockImplementation((selector: unknown) => {
      const state = {
        stats: { embedded: 50, pending: 30, error: 20, total: 100, missing: 3 },
        statsLoading: false,
        filling: false,
        fillProgress: null,
        fetchStats: vi.fn(),
        fillMissing,
      };
      return selector ? (selector as (s: unknown) => unknown)(state) : state;
    });

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('missing')).toBeTruthy());
    fireEvent.click(screen.getByText('fillMissing'));
    expect(fillMissing).toHaveBeenCalledTimes(1);
  });
});
