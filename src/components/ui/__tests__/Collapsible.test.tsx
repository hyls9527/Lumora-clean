import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Collapsible } from '../Collapsible';

afterEach(() => { cleanup(); });

describe('Collapsible', () => {
  it('should render title', () => {
    render(<Collapsible title="高级设置"><div>content</div></Collapsible>);
    expect(screen.getByText('高级设置')).toBeDefined();
  });

  it('should not render children when closed by default', () => {
    render(<Collapsible title="高级设置"><div>hidden content</div></Collapsible>);
    expect(screen.queryByText('hidden content')).toBeNull();
  });

  it('should render children when defaultOpen is true', () => {
    render(<Collapsible title="高级设置" defaultOpen><div>visible content</div></Collapsible>);
    expect(screen.getByText('visible content')).toBeDefined();
  });

  it('should toggle children on click', async () => {
    render(<Collapsible title="高级设置"><p>toggle content</p></Collapsible>);
    expect(screen.queryByText('toggle content')).toBeNull();

    const trigger = screen.getAllByRole('button')[0];
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('toggle content')).toBeDefined();
    });

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByText('toggle content')).toBeNull();
    });
  });

  it('should toggle on Enter key', async () => {
    render(<Collapsible title="高级设置"><p>keyboard content</p></Collapsible>);
    fireEvent.keyDown(screen.getAllByRole('button')[0], { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('keyboard content')).toBeDefined();
    });
  });

  it('should toggle on Space key', async () => {
    render(<Collapsible title="高级设置"><p>space content</p></Collapsible>);
    fireEvent.keyDown(screen.getAllByRole('button')[0], { key: ' ' });
    await waitFor(() => {
      expect(screen.getByText('space content')).toBeDefined();
    });
  });

  it('should have aria-expanded attribute', async () => {
    render(<Collapsible title="高级设置"><p>content</p></Collapsible>);
    const trigger = screen.getAllByRole('button')[0];
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  });
});
