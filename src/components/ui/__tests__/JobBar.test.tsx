import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JobBar } from '../JobBar';
import { useJobStore } from '../../../stores/jobStore';
import type { JobStatus } from '../../../lib/api/jobs';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    // Echo the key so assertions do not depend on copy, and so a missing key is
    // visible as a raw key rather than silently empty text.
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}(${JSON.stringify(params)})` : key,
  }),
}));

function job(over: Partial<JobStatus> = {}): JobStatus {
  return {
    id: 1,
    kind: 'embed_missing',
    state: 'running',
    processed: 25,
    total: 100,
    failed: 0,
    message: null,
    startedAtMs: 0,
    updatedAtMs: 0,
    cancelRequested: false,
    ...over,
  };
}

describe('JobBar', () => {
  beforeEach(() => {
    cleanup();
    useJobStore.setState({ active: [], recent: [], error: null });
  });

  it('renders nothing when there is no work', () => {
    const { container } = render(<JobBar />);
    // The bar must cost zero attention in the common case.
    expect(container.firstChild).toBeNull();
  });

  it('shows progress for an active job', () => {
    useJobStore.setState({ active: [job()] });
    render(<JobBar />);

    expect(screen.getByRole('status')).toBeTruthy();
    // Substring match: the same label is also the progress bar's aria-label, so
    // an exact-text query would be ambiguous.
    expect(screen.getByText('embed_missing', { exact: false })).toBeTruthy();
    expect(screen.getByText('jobs.progress({"processed":25,"total":100})')).toBeTruthy();
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
  });

  it('offers Cancel while the job runs and calls the store', () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    useJobStore.setState({ active: [job()], cancel });
    render(<JobBar />);

    fireEvent.click(screen.getByRole('button', { name: 'jobs.cancel' }));
    expect(cancel).toHaveBeenCalledWith(1);
  });

  it('disables Cancel once the stop has been requested', () => {
    useJobStore.setState({ active: [job({ cancelRequested: true })] });
    render(<JobBar />);

    const button = screen.getByRole('button', { name: 'jobs.cancelling' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('reports how a finished job ended', () => {
    useJobStore.setState({ recent: [job({ state: 'cancelled', processed: 40 })] });
    render(<JobBar />);

    expect(screen.getByText('jobs.state.cancelled')).toBeTruthy();
    // No Cancel button for work that already stopped.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a failure reason so the user is not left guessing', () => {
    useJobStore.setState({ recent: [job({ state: 'failed', message: '上游超时' })] });
    render(<JobBar />);

    expect(screen.getByText('jobs.state.failed')).toBeTruthy();
  });

  it('shows an indeterminate label when the total is unknown', () => {
    useJobStore.setState({ active: [job({ total: 0, processed: 7 })] });
    render(<JobBar />);

    expect(screen.getByText('jobs.progressUnknown({"processed":7})')).toBeTruthy();
    // Unknown total: no fake percentage in the a11y tree.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  });

  it('surfaces a store-level error', () => {
    useJobStore.setState({ error: '读取任务状态失败' });
    render(<JobBar />);

    expect(screen.getByText('读取任务状态失败')).toBeTruthy();
  });
});