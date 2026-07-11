import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ToastContainer } from '../Toast';
import { useToastStore } from '../../../stores/toastStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clearToasts();
  });

  it('should render without crashing', () => {
    const { container } = render(<ToastContainer />);
    expect(container).toBeDefined();
  });

  it('should not render when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.textContent).toBe('');
  });

  it('should render toast when added', () => {
    const { container } = render(<ToastContainer />);
    act(() => {
      useToastStore.getState().addToast('success', 'Test message');
    });
    expect(container.textContent).toContain('Test message');
  });
});
