import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Rating } from '../Rating';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

describe('Rating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<Rating value={3} onChange={vi.fn()} />);
    expect(container).toBeDefined();
  });

  it('should render 5 stars', () => {
    const { container } = render(<Rating value={3} onChange={vi.fn()} />);
    const stars = container.querySelectorAll('span[role="button"], button');
    expect(stars.length).toBe(5);
  });

  it('should call onChange when clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<Rating value={3} onChange={onChange} />);
    const stars = container.querySelectorAll('span[role="button"], button');
    fireEvent.click(stars[4]); // Click 5th star
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
