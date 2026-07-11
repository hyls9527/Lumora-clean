import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ExportPage } from '../ExportPage';

// Mock dependencies
vi.mock('../../../stores/imageStore', () => ({
  useImageStore: () => ({
    images: [
      { id: '1', filePath: '/img1.png', fileName: 'img1.png' },
      { id: '2', filePath: '/img2.png', fileName: 'img2.png' },
    ],
    fetchImages: vi.fn(),
    exportImages: vi.fn().mockResolvedValue({ success: 2, failed: 0, destDir: '/export' }),
  }),
}));

vi.mock('../../../hooks/useSelection', () => ({
  useSelection: () => ({
    selectedIds: new Set(),
    toggleSelect: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (k: string, params?: Record<string, string>) => {
      if (params) return `${k}(${JSON.stringify(params)})`;
      return k;
    },
  }),
  t: (k: string) => k,
}));

describe('ExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render export page', () => {
    const { container } = render(<ExportPage />);
    expect(container).toBeDefined();
  });

  it('should render with correct structure', () => {
    const { container } = render(<ExportPage />);
    // Should have sections for selection, destination, format, template
    const sections = container.querySelectorAll('section');
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it('should render format buttons', () => {
    const { container } = render(<ExportPage />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4); // At least 4 format buttons + browse + export
  });
});
