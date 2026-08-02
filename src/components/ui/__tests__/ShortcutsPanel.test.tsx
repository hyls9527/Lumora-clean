import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortcutsPanel, type ShortcutGroup } from '../ShortcutsPanel';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        title: 'Keyboard Shortcuts',
        close: 'Close',
      };
      return translations[key] ?? key;
    },
  })),
}));

afterEach(() => { cleanup(); });

const mockGroups: ShortcutGroup[] = [
  {
    heading: 'Navigation',
    items: [
      { action: 'Search images', key: '⌘K' },
      { action: 'Open detail', key: 'Enter' },
    ],
  },
  {
    heading: 'Actions',
    items: [
      { action: 'Toggle favorite', key: 'F' },
      { action: 'Move to trash', key: 'Delete' },
    ],
  },
];

describe('ShortcutsPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ShortcutsPanel isOpen={false} onClose={() => {}} groups={mockGroups} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the panel when open', () => {
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={mockGroups} />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('renders group headings', () => {
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={mockGroups} />);
    expect(screen.getByText('Navigation')).toBeDefined();
    expect(screen.getByText('Actions')).toBeDefined();
  });

  it('renders all shortcut items', () => {
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={mockGroups} />);
    expect(screen.getByText('Search images')).toBeDefined();
    expect(screen.getByText('⌘K')).toBeDefined();
    expect(screen.getByText('Open detail')).toBeDefined();
    expect(screen.getByText('Enter')).toBeDefined();
    expect(screen.getByText('Toggle favorite')).toBeDefined();
    expect(screen.getByText('F')).toBeDefined();
    expect(screen.getByText('Move to trash')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutsPanel isOpen onClose={onClose} groups={mockGroups} />);

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutsPanel isOpen onClose={onClose} groups={mockGroups} />);

    const dialog = screen.getByRole('dialog');
    // Click directly on the overlay backdrop (not the panel)
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the panel', () => {
    const onClose = vi.fn();
    render(<ShortcutsPanel isOpen onClose={onClose} groups={mockGroups} />);

    fireEvent.click(screen.getByText('Search images'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<ShortcutsPanel isOpen onClose={onClose} groups={mockGroups} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not listen to Escape when closed', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ShortcutsPanel isOpen={false} onClose={onClose} groups={mockGroups} />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    rerender(<ShortcutsPanel isOpen onClose={onClose} groups={mockGroups} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has proper aria attributes', () => {
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={mockGroups} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Keyboard Shortcuts');
  });

  it('renders empty groups without errors', () => {
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={[]} />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('renders a group with no items', () => {
    const groupsWithEmpty: ShortcutGroup[] = [
      { heading: 'Empty', items: [] },
    ];
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={groupsWithEmpty} />);
    expect(screen.getByText('Empty')).toBeDefined();
  });

  it('renders kbd elements with monospace font', () => {
    render(<ShortcutsPanel isOpen onClose={() => {}} groups={mockGroups} />);

    const kbdElements = document.querySelectorAll('kbd');
    expect(kbdElements.length).toBe(4);

    const firstKbd = kbdElements[0] as HTMLElement;
    const computedStyle = firstKbd.style.fontFamily;
    expect(computedStyle).toContain('monospace');
  });
});
