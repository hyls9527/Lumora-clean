import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SimilarityBadge } from '../SimilarityBadge';

describe('SimilarityBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<SimilarityBadge value={85} />);
    expect(container).toBeDefined();
  });

  it('should display similarity value', () => {
    const { container } = render(<SimilarityBadge value={85} />);
    expect(container.textContent).toContain('85');
  });

  it('should render with high similarity', () => {
    const { container } = render(<SimilarityBadge value={95} />);
    expect(container).toBeDefined();
  });

  it('should render with low similarity', () => {
    const { container } = render(<SimilarityBadge value={30} />);
    expect(container).toBeDefined();
  });
});
