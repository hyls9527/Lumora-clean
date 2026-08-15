import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FirstRunModal } from '../FirstRunModal';

// Mock i18n (keys render as themselves)
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

vi.mock('../../../lib/tokens', () => ({
  t: {
    textMuted: '#888',
    accent: '#7a5c12',
    bg: '#f2ede4',
  },
}));

describe('FirstRunModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<FirstRunModal open={false} onChoose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('offers both import modes and calls back with the choice', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<FirstRunModal open onChoose={onChoose} />);
    expect(screen.getByText('referenceTitle')).toBeDefined();
    expect(screen.getByText('copyTitle')).toBeDefined();
    expect(screen.getByText('uninstallWarning')).toBeDefined();
    await user.click(screen.getByRole('button', { name: /copyTitle/ }));
    expect(onChoose).toHaveBeenCalledWith('copy');
  });
});
