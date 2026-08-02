import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ConvertDialog } from '../ConvertDialog';
import { batchConvert } from '../../../lib/api/images';

vi.mock('../../../lib/api/images', () => ({
  batchConvert: vi.fn(),
}));

vi.mock('../../../lib/i18n', () => ({
  t: (key: string, _lang?: unknown, params?: Record<string, unknown>) => {
    if (params) return `${key}(${JSON.stringify(params)})`;
    return key;
  },
}));

afterEach(() => {
  cleanup();
});

describe('ConvertDialog', () => {
  const onClose = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <ConvertDialog open={false} imageIds={['a']} onClose={onClose} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows i18n files count in the title', () => {
    render(<ConvertDialog open imageIds={['a', 'b']} onClose={onClose} />);
    expect(screen.getByText(/convert\.filesCount\(\{"count":2\}\)/)).toBeDefined();
  });

  it('renders all 7 target formats', () => {
    render(<ConvertDialog open imageIds={['a']} onClose={onClose} />);
    for (const label of ['PNG', 'JPEG', 'WebP', 'AVIF', 'BMP', 'GIF', 'TIFF']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('disables execute when no images selected', () => {
    render(<ConvertDialog open imageIds={[]} onClose={onClose} />);
    expect(screen.getByText('convert.execute').closest('button')?.disabled).toBe(true);
  });

  it('calls batchConvert with selected format and shows result', async () => {
    vi.mocked(batchConvert).mockResolvedValue({
      items: [],
      converted: 2,
      skipped: 0,
      failed: 0,
    });
    render(<ConvertDialog open imageIds={['a', 'b']} onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('WebP'));
    fireEvent.click(screen.getByText('convert.execute'));

    await waitFor(() => {
      expect(batchConvert).toHaveBeenCalledWith(['a', 'b'], 'webp');
    });
    expect(await screen.findByText(/convert\.result\(\{"converted":2/)).toBeDefined();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows error message when conversion fails', async () => {
    vi.mocked(batchConvert).mockRejectedValue(new Error('disk full'));
    render(<ConvertDialog open imageIds={['a']} onClose={onClose} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('convert.execute'));

    expect((await screen.findByRole('alert')).textContent).toContain('disk full');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('clears result and error when reopened', async () => {
    vi.mocked(batchConvert).mockResolvedValue({
      items: [],
      converted: 1,
      skipped: 0,
      failed: 0,
    });
    const { rerender } = render(<ConvertDialog open imageIds={['a']} onClose={onClose} />);
    fireEvent.click(screen.getByText('convert.execute'));
    await screen.findByText(/convert\.result/);

    rerender(<ConvertDialog open={false} imageIds={['a']} onClose={onClose} />);
    rerender(<ConvertDialog open imageIds={['a']} onClose={onClose} />);

    expect(screen.queryByText(/convert\.result/)).toBeNull();
  });
});
