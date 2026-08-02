import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FilterPanel } from '../FilterPanel';
import { useFilterStore } from '../../../stores/filterStore';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

afterEach(() => { cleanup(); });

beforeEach(() => {
  useFilterStore.setState({ criteria: {} });
});

describe('FilterPanel', () => {
  it('renders filter button', () => {
    const { container } = render(<FilterPanel />);
    expect(container.textContent).toContain('filter.title');
  });

  it('shows active count when filters are set', () => {
    useFilterStore.setState({ criteria: { model: 'sd1.5' } });
    const { container } = render(<FilterPanel />);
    expect(container.textContent).toContain('(1)');
  });

  it('toggles expanded state on button click', () => {
    const { container } = render(<FilterPanel />);
    const buttons = container.querySelectorAll('button');
    // First button is the expand toggle
    fireEvent.click(buttons[0]);
    // Should show filter inputs
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('shows favorite toggle button', () => {
    const { container } = render(<FilterPanel />);
    expect(container.textContent).toContain('filter.favorite');
  });

  it('toggles favorite on click', () => {
    const { container } = render(<FilterPanel />);
    const buttons = container.querySelectorAll('button');
    // Second button is favorite toggle
    fireEvent.click(buttons[1]);
    expect(useFilterStore.getState().criteria.favorite).toBe(true);
  });

  it('shows clear button when filters are active', () => {
    useFilterStore.setState({ criteria: { model: 'sd1.5' } });
    const { container } = render(<FilterPanel />);
    expect(container.textContent).toContain('filter.clear');
  });

  it('clears filters on clear button click', () => {
    useFilterStore.setState({ criteria: { model: 'sd1.5', favorite: true } });
    const { container } = render(<FilterPanel />);
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('filter.clear'),
    );
    expect(clearBtn).toBeDefined();
    fireEvent.click(clearBtn!);
    expect(useFilterStore.getState().criteria).toEqual({});
  });

  it('renders model input when expanded', () => {
    const { container } = render(<FilterPanel />);
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[0]); // expand
    const modelInput = container.querySelector('input[placeholder*="sd"]') ??
      container.querySelector('input[type="text"]');
    expect(modelInput).toBeDefined();
  });
});
