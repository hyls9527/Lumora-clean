import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CommandPalette } from '../CommandPalette';
import { useModalEsc } from '../../../hooks/useModalEsc';
import { resetModalStackForTests } from '../../../lib/modalStack';

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock the stores
const mockClose = vi.fn();
const mockCommands = [
  {
    id: 'nav-gallery',
    name: '创作者图库',
    description: '浏览创作者图库',
    section: 'navigation',
    action: vi.fn(),
    shortcut: '⌘1',
  },
  {
    id: 'action-import',
    name: '导入图片',
    description: '导入新图片',
    section: 'action',
    action: vi.fn(),
  },
];

vi.mock('../../../stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    isOpen: true,
    close: mockClose,
    commands: mockCommands,
  })),
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        placeholder: '搜索命令...',
        ariaLabel: '搜索命令',
        noResults: '没有找到结果',
        sectionNavigation: '导航',
        sectionAction: '操作',
      };
      return translations[key] ?? key;
    },
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  resetModalStackForTests();
});

describe('CommandPalette', () => {
  it('renders when isOpen is true', () => {
    render(<CommandPalette />);

    expect(screen.getByPlaceholderText('搜索命令...')).toBeDefined();
  });

  it('renders navigation section', () => {
    render(<CommandPalette />);

    expect(screen.getByText('导航')).toBeDefined();
  });

  it('renders action section', () => {
    render(<CommandPalette />);

    expect(screen.getByText('操作')).toBeDefined();
  });

  it('renders all commands', () => {
    render(<CommandPalette />);

    expect(screen.getByText('创作者图库')).toBeDefined();
    expect(screen.getByText('导入图片')).toBeDefined();
  });

  it('renders shortcuts', () => {
    render(<CommandPalette />);

    expect(screen.getByText('⌘1')).toBeDefined();
  });

  it('filters commands when typing', () => {
    render(<CommandPalette />);

    const input = screen.getByPlaceholderText('搜索命令...');
    fireEvent.change(input, { target: { value: '导入' } });

    expect(screen.getByText('导入图片')).toBeDefined();
    expect(screen.queryByText('创作者图库')).toBeNull();
  });

  it('shows no results message when no matches', () => {
    render(<CommandPalette />);

    const input = screen.getByPlaceholderText('搜索命令...');
    fireEvent.change(input, { target: { value: 'xyz123' } });

    expect(screen.getByText('没有找到结果')).toBeDefined();
  });

  it('has listbox role for accessibility', () => {
    render(<CommandPalette />);

    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('has correct panel border radius', () => {
    render(<CommandPalette />);

    const panel = screen.getByRole('listbox').parentElement;
    expect(panel?.style.borderRadius).toBe('6px');
  });

  it('closes on Escape when it is the topmost modal', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(screen.getByPlaceholderText('搜索命令...'), { key: 'Escape' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('does not close a modal below the palette on Escape', () => {
    const closeBelow = vi.fn();
    function ModalBelow() {
      useModalEsc(true, closeBelow);
      return <div data-testid="below" />;
    }
    render(
      <>
        <ModalBelow />
        <CommandPalette />
      </>,
    );

    fireEvent.keyDown(screen.getByPlaceholderText('搜索命令...'), { key: 'Escape' });

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(closeBelow).not.toHaveBeenCalled();
  });

  it('wraps Tab focus within the palette panel', () => {
    render(<CommandPalette />);
    const input = screen.getByPlaceholderText('搜索命令...');

    // Focus the last focusable (a command button) and Tab forward to wrap.
    const buttons = screen.getAllByRole('button');
    const lastButton = buttons[buttons.length - 1];
    lastButton.focus();

    fireEvent.keyDown(lastButton, { key: 'Tab' });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastButton);
  });
});
