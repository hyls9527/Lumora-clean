import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CommandPalette } from '../CommandPalette';

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
});
