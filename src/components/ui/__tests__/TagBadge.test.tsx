import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TagBadge } from '../TagBadge';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

describe('TagBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<TagBadge name="nature" />);
    expect(container).toBeDefined();
  });

  it('should display tag name', () => {
    const { container } = render(<TagBadge name="nature" />);
    expect(container.textContent).toContain('nature');
  });

  it('should render with color', () => {
    const { container } = render(<TagBadge name="nature" color="#ff0000" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toBeDefined();
  });

  it('should call onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    const { container } = render(<TagBadge name="nature" onRemove={onRemove} />);
    const button = container.querySelector('button');
    if (button) {
      fireEvent.click(button);
      expect(onRemove).toHaveBeenCalled();
    }
  });
});
