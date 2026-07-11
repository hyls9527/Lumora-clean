import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GridSkeleton } from '../LoadingSkeleton';

describe('GridSkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<GridSkeleton />);
    expect(container).toBeDefined();
  });

  it('should render skeleton items', () => {
    const { container } = render(<GridSkeleton count={3} />);
    expect(container).toBeDefined();
  });
});
