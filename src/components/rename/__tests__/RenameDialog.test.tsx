import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenameDialog } from '../RenameDialog';
import { batchRename } from '../../../lib/api/images';

vi.mock('../../../lib/api/images', () => ({
  batchRename: vi.fn(),
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string, params?: Record<string, unknown>) => {
    if (params) return `${k}(${JSON.stringify(params)})`;
    return k;
  },
}));

afterEach(() => { cleanup(); });

const makePreviewItem = (id: string, oldName: string, newName: string, status = 'ok') => ({
  id,
  oldName,
  newName,
  status,
  error: undefined,
});

describe('RenameDialog', () => {
  const onClose = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <RenameDialog open={false} imageIds={['a', 'b']} onClose={onClose} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when open is true', () => {
    const { container } = render(
      <RenameDialog open imageIds={['a', 'b']} onClose={onClose} />,
    );
    expect(container.textContent).toContain('rename.title');
    expect(container.textContent).toContain('(2 files)');
  });

  it('shows template input', () => {
    const { container } = render(
      <RenameDialog open imageIds={['a', 'b']} onClose={onClose} />,
    );
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeDefined();
  });

  it('calls batchRename with dryRun on template change (debounced)', async () => {
    const mockPreview = {
      items: [
        makePreviewItem('a', 'old_a.png', 'new_a.png'),
        makePreviewItem('b', 'old_b.png', 'new_b.png'),
      ],
      renamed: 2,
      skipped: 0,
      errors: 0,
    };
    vi.mocked(batchRename).mockResolvedValue(mockPreview);

    const { container } = render(
      <RenameDialog open imageIds={['a', 'b']} onClose={onClose} />,
    );
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '{name}_test' } });

    await waitFor(() => {
      expect(batchRename).toHaveBeenCalledWith(['a', 'b'], '{name}_test', true);
    });
  });

  it('disables execute button when template is empty', () => {
    const { container } = render(
      <RenameDialog open imageIds={['a']} onClose={onClose} />,
    );
    const executeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'rename.execute',
    );
    expect(executeBtn).toBeDefined();
    expect(executeBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('enables execute button when there are name changes', async () => {
    const mockPreview = {
      items: [makePreviewItem('a', 'old_a.png', 'new_a.png')],
      renamed: 1,
      skipped: 0,
      errors: 0,
    };
    vi.mocked(batchRename).mockResolvedValue(mockPreview);

    const { container } = render(
      <RenameDialog open imageIds={['a']} onClose={onClose} />,
    );
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '{name}_test' } });

    await waitFor(() => {
      const executeBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'rename.execute',
      );
      expect(executeBtn).toBeDefined();
      expect(executeBtn!.hasAttribute('disabled')).toBe(false);
    });
  });

  it('calls batchRename without dryRun on execute', async () => {
    const mockPreview = {
      items: [makePreviewItem('a', 'old_a.png', 'new_a.png')],
      renamed: 1,
      skipped: 0,
      errors: 0,
    };
    const mockResult = {
      items: [makePreviewItem('a', 'old_a.png', 'new_a.png', 'ok')],
      renamed: 1,
      skipped: 0,
      errors: 0,
    };
    vi.mocked(batchRename)
      .mockResolvedValueOnce(mockPreview)  // dryRun
      .mockResolvedValueOnce(mockResult);   // actual

    const { container } = render(
      <RenameDialog open imageIds={['a']} onClose={onClose} onComplete={onComplete} />,
    );
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '{name}_test' } });

    await waitFor(() => {
      expect(batchRename).toHaveBeenCalledWith(['a'], '{name}_test', true);
    });

    const executeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'rename.execute',
    )!;
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(batchRename).toHaveBeenCalledWith(['a'], '{name}_test', false);
      expect(onComplete).toHaveBeenCalledWith(mockResult);
    });
  });

  it('shows preview items in table', async () => {
    const mockPreview = {
      items: [
        makePreviewItem('a', 'old_a.png', 'new_a.png'),
        makePreviewItem('b', 'old_b.png', 'new_b.png'),
      ],
      renamed: 2,
      skipped: 0,
      errors: 0,
    };
    vi.mocked(batchRename).mockResolvedValue(mockPreview);

    const { container } = render(
      <RenameDialog open imageIds={['a', 'b']} onClose={onClose} />,
    );
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '{name}_test' } });

    await waitFor(() => {
      expect(container.textContent).toContain('old_a.png');
      expect(container.textContent).toContain('new_a.png');
      expect(container.textContent).toContain('old_b.png');
      expect(container.textContent).toContain('new_b.png');
    });
  });

  it('shows result after successful rename', async () => {
    const mockResult = {
      items: [makePreviewItem('a', 'old_a.png', 'new_a.png', 'ok')],
      renamed: 1,
      skipped: 0,
      errors: 0,
    };
    // Return same value for both dryRun and actual
    vi.mocked(batchRename).mockResolvedValue(mockResult);

    const { container } = render(
      <RenameDialog open imageIds={['a']} onClose={onClose} onComplete={onComplete} />,
    );

    // Type template to trigger preview
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '{name}_test' } });

    // Wait for the preview to load (debounced)
    await vi.waitFor(() => {
      // The t() mock returns "rename.oldName" etc — check for table with row data
      expect(container.querySelector('table')).toBeTruthy();
    }, { timeout: 2000 });

    // Click execute
    const executeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'rename.execute',
    )!;
    expect(executeBtn).toBeTruthy();
    fireEvent.click(executeBtn);

    // Wait for result to render
    await vi.waitFor(() => {
      // Result renders: t('rename.result', { renamed: 1, skipped: 0 })
      // With our mock: "rename.result({"renamed":1,"skipped":0})"
      expect(container.textContent).toContain('skipped');
    }, { timeout: 2000 });
  });

  it('calls onClose on overlay click', () => {
    const { container } = render(
      <RenameDialog open imageIds={['a']} onClose={onClose} />,
    );
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows conflict status for conflict items', async () => {
    const mockPreview = {
      items: [makePreviewItem('a', 'old_a.png', 'new_a.png', 'conflict')],
      renamed: 1,
      skipped: 0,
      errors: 0,
    };
    vi.mocked(batchRename).mockResolvedValue(mockPreview);

    const { container } = render(
      <RenameDialog open imageIds={['a']} onClose={onClose} />,
    );
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '{name}_test' } });

    await waitFor(() => {
      // The conflict status appends ' (rename.conflict)' to the newName cell
      const cells = container.querySelectorAll('td');
      const hasConflict = Array.from(cells).some((c) => c.textContent?.includes('conflict'));
      expect(hasConflict).toBe(true);
    });
  });
});
