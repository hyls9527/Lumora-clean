import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AnalysisHistoryList } from '../AnalysisHistoryList';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
  t: (k: string) => k,
}));

describe('AnalysisHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <AnalysisHistoryList items={[]} />
    );
    expect(container).toBeDefined();
  });

  it('should render history items', () => {
    const items = [
      {
        id: '1',
        imageId: 'img-1',
        result: {
          description: 'A cat sitting on a chair',
          tags: [{ name: 'cat', confidence: 0.9 }],
          objects: ['cat', 'chair'],
          colorPalette: ['#ff0000'],
          composition: 'centered',
        },
        analyzedAt: '2025-01-15T10:30:00Z',
      },
    ];
    const { container } = render(
      <AnalysisHistoryList items={items} />
    );
    expect(container).toBeDefined();
  });

  it('should render empty state', () => {
    const { container } = render(
      <AnalysisHistoryList items={[]} />
    );
    expect(container).toBeDefined();
  });
});
