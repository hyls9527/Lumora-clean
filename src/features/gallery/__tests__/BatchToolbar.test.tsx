import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { BatchToolbar } from '../BatchToolbar';

afterEach(() => { cleanup(); });

describe('BatchToolbar', () => {
  const defaultProps = {
    count: 3,
    onDelete: vi.fn(),
    onAiTag: vi.fn(),
    onEmbed: vi.fn(),
    onCancel: vi.fn(),
    deleting: false,
    tagging: false,
    embedding: false,
  };

  it('should render embed button', () => {
    const { container } = render(<BatchToolbar {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(4);
    expect(buttons[2].textContent).toContain('embed');
  });

  it('should call onEmbed when embed button clicked', () => {
    const onEmbed = vi.fn();
    const { container } = render(<BatchToolbar {...defaultProps} onEmbed={onEmbed} />);
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[2]);
    expect(onEmbed).toHaveBeenCalled();
  });

  it('should disable embed button when embedding', () => {
    const { container } = render(<BatchToolbar {...defaultProps} embedding={true} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons[2].disabled).toBe(true);
    expect(buttons[2].textContent).toContain('embedding');
  });

  it('should not render when count is 0', () => {
    const { container } = render(<BatchToolbar {...defaultProps} count={0} />);
    expect(container.textContent).toBe('');
  });
});
