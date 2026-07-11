import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MobileNav } from '../MobileNav';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <MobileNav activeRoute="/gallery" onNavigate={vi.fn()} />
    );
    expect(container).toBeDefined();
  });

  it('should render navigation items', () => {
    const { container } = render(
      <MobileNav activeRoute="/gallery" onNavigate={vi.fn()} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(5);
  });

  it('should call onNavigate when clicked', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <MobileNav activeRoute="/gallery" onNavigate={onNavigate} />
    );
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[1]); // Click search
    expect(onNavigate).toHaveBeenCalledWith('/search');
  });

  it('should highlight active route', () => {
    const { container } = render(
      <MobileNav activeRoute="/search" onNavigate={vi.fn()} />
    );
    const buttons = container.querySelectorAll('button');
    const activeButton = buttons[1]; // Search is second
    expect(activeButton.getAttribute('aria-current')).toBe('page');
  });
});
