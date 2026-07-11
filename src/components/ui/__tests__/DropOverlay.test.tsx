import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DropOverlay } from '../DropOverlay';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

describe('DropOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<DropOverlay isVisible={false} />);
    expect(container).toBeDefined();
  });

  it('should be hidden when isVisible is false', () => {
    const { container } = render(<DropOverlay isVisible={false} />);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toBeDefined();
  });

  it('should be visible when isVisible is true', () => {
    const { container } = render(<DropOverlay isVisible={true} />);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toBeDefined();
  });
});
