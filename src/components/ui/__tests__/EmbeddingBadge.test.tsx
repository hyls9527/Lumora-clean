import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { EmbeddingBadge } from '../EmbeddingBadge';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (k: string) => {
      const map: Record<string, string> = {
        statusEmbedded: '已嵌入',
        statusPending: '待处理',
        statusError: '错误',
      };
      return map[k] || k;
    },
  }),
  t: (k: string) => k,
}));

describe('EmbeddingBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<EmbeddingBadge status="pending" />);
    expect(container).toBeDefined();
  });

  it('should display pending symbol', () => {
    const { container } = render(<EmbeddingBadge status="pending" />);
    expect(container.textContent).toContain('○');
  });

  it('should display embedded symbol', () => {
    const { container } = render(<EmbeddingBadge status="embedded" />);
    expect(container.textContent).toContain('✓');
  });

  it('should display error symbol', () => {
    const { container } = render(<EmbeddingBadge status="error" />);
    expect(container.textContent).toContain('✗');
  });
});
