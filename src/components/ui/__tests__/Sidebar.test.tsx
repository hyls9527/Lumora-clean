import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

// Mock dependencies
vi.mock('../../../hooks/useOllamaStatus', () => ({
  useOllamaStatus: () => ({ available: true, checking: false, error: null, recheck: vi.fn() }),
}));
vi.mock('../../../stores/smartCollectionStore', () => ({
  useSmartCollectionStore: Object.assign(
    () => ({ collections: [], load: vi.fn() }),
    { getState: () => ({ collections: [], load: vi.fn() }) },
  ),
}));
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));
vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));
vi.mock('../UpdateBanner', () => ({
  UpdateBanner: () => null,
}));

describe('Sidebar keyboard navigation', () => {
  function getNavButtons() {
    // Nav buttons are inside <nav>, exclude search button and ollama button
    const nav = document.querySelector('nav[aria-label]') || document.querySelector('nav');
    if (!nav) return [];
    return Array.from(nav.querySelectorAll('button'));
  }

  it('should focus next button on ArrowDown', () => {
    render(<Sidebar activeRoute="/gallery" onNavigate={vi.fn()} />);
    const navButtons = getNavButtons();
    expect(navButtons.length).toBeGreaterThan(1);

    navButtons[0].focus();
    expect(document.activeElement).toBe(navButtons[0]);

    fireEvent.keyDown(navButtons[0].parentElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(navButtons[1]);
  });

  it('should focus previous button on ArrowUp', () => {
    render(<Sidebar activeRoute="/favorites" onNavigate={vi.fn()} />);
    const navButtons = getNavButtons();

    navButtons[1].focus();
    fireEvent.keyDown(navButtons[1].parentElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(navButtons[0]);
  });

  it('should wrap to first button on ArrowDown from last', () => {
    render(<Sidebar activeRoute="/trash" onNavigate={vi.fn()} />);
    const navButtons = getNavButtons();

    navButtons[navButtons.length - 1].focus();
    fireEvent.keyDown(navButtons[navButtons.length - 1].parentElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(navButtons[0]);
  });

  it('should focus first button on Home', () => {
    render(<Sidebar activeRoute="/settings" onNavigate={vi.fn()} />);
    const navButtons = getNavButtons();

    navButtons[4].focus();
    fireEvent.keyDown(navButtons[4].parentElement!, { key: 'Home' });
    expect(document.activeElement).toBe(navButtons[0]);
  });

  it('should focus last button on End', () => {
    render(<Sidebar activeRoute="/gallery" onNavigate={vi.fn()} />);
    const navButtons = getNavButtons();

    navButtons[0].focus();
    fireEvent.keyDown(navButtons[0].parentElement!, { key: 'End' });
    expect(document.activeElement).toBe(navButtons[navButtons.length - 1]);
  });
});
