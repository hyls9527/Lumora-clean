import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';

// Mock the API layer
vi.mock('../../../lib/api/images', () => ({
  getDashboardStats: vi.fn().mockResolvedValue({
    totalImages: 100,
    totalSizeKb: 500000,
    formatCounts: [],
    ratingCounts: [],
    topTags: [],
    recentImports: [],
  }),
  toImageRecord: (r: unknown) => r,
}));

// Mock the store
vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: vi.fn((selector) => {
    const state = {
      stats: { embedded: 50, pending: 30, error: 20, total: 100 },
      statsLoading: false,
      fetchStats: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
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

  it('should render without crashing', () => {
    const { container } = render(<DashboardPage />);
    expect(container).toBeDefined();
  });
});
