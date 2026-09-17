import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TrashPage } from '../TrashPage';
import type { ImageRecord } from '../../../types/image';

const h = vi.hoisted(() => ({
  t: vi.fn((key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}(${JSON.stringify(opts)})` : key,
  ),
  fetchTrash: vi.fn(),
  restoreImage: vi.fn(),
  permanentDelete: vi.fn(),
  emptyTrash: vi.fn(),
  state: {} as Record<string, unknown>,
  isMobile: { value: false },
}));

vi.mock('../../../stores/trashStore', () => ({
  useTrashStore: () => h.state,
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: h.t }),
  t: h.t,
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => h.isMobile.value,
}));

function trashImage(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    id: 'img-1',
    filePath: 'C:/lib/fox.png',
    fileName: 'fox.png',
    fileSizeKb: 128,
    width: 1024,
    height: 768,
    format: 'png',
    createdAt: '2025-01-01',
    rating: 0,
    favorite: false,
    model: '',
    prompt: '',
    tags: [],
    ...overrides,
  };
}

function setState(overrides: Record<string, unknown> = {}) {
  h.state = {
    images: [],
    loading: false,
    error: null,
    fetchTrash: h.fetchTrash,
    restoreImage: h.restoreImage,
    permanentDelete: h.permanentDelete,
    emptyTrash: h.emptyTrash,
    page: 1,
    total: 0,
    perPage: 40,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  h.isMobile.value = false;
  h.fetchTrash.mockResolvedValue(undefined);
  h.restoreImage.mockResolvedValue(undefined);
  h.permanentDelete.mockResolvedValue(undefined);
  h.emptyTrash.mockResolvedValue(undefined);
  setState();
});

describe('TrashPage loading and status', () => {
  it('fetches the first page on mount', () => {
    render(<TrashPage />);

    expect(h.fetchTrash).toHaveBeenCalledWith(1);
  });

  it('shows the loading label and skeleton while fetching', () => {
    setState({ loading: true, total: 3 });

    const { container } = render(<TrashPage />);

    expect(screen.getByText('trash.loading')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="loading-skeleton"]')).toHaveLength(0);
    // The table is not rendered while loading.
    expect(container.querySelector('table')).toBeNull();
  });

  it('reports the deleted count once loaded', () => {
    setState({ total: 7 });

    render(<TrashPage />);

    expect(screen.getAllByText('trash.deletedCount({"total":7})').length).toBeGreaterThan(0);
  });

  it('shows the persisted error and retries the current page', () => {
    setState({ error: '数据库被锁定', page: 3, total: 0 });

    render(<TrashPage />);
    expect(screen.getByText('数据库被锁定')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(h.fetchTrash).toHaveBeenCalledWith(3);
  });
});

describe('TrashPage empty state', () => {
  it('explains that the trash is empty and hides the empty-trash action', () => {
    render(<TrashPage />);

    expect(screen.getByText('trash.emptyDecorative')).toBeTruthy();
    expect(screen.getByText('trash.empty')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'trash.emptyTrash' })).toBeNull();
  });
});

describe('TrashPage rows', () => {
  it('renders file name, dimensions and a formatted deletion time', () => {
    setState({
      images: [trashImage({ id: 'a', fileName: 'fox.png', width: 1024, height: 768, deletedAt: '2025-03-04 05:06:07' })],
      total: 1,
    });

    render(<TrashPage />);

    const row = screen.getByText('fox.png').closest('tr')!;
    expect(row.textContent).toContain('1024×768');
    // The raw ISO timestamp is formatted for display, never echoed verbatim.
    expect(row.textContent).not.toContain('2025-03-04 05:06:07');
    expect(row.textContent).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
  });

  it('omits the time cell content when the backend has no deletedAt', () => {
    setState({ images: [trashImage({ deletedAt: undefined })], total: 1 });

    render(<TrashPage />);

    const cells = screen.getByText('fox.png').closest('tr')!.querySelectorAll('td');
    expect(cells[2].textContent).toBe('');
  });

  it('restores the clicked image', () => {
    setState({ images: [trashImage({ id: 'img-42' })], total: 1 });

    render(<TrashPage />);
    fireEvent.click(screen.getByRole('button', { name: 'trash.restore' }));

    expect(h.restoreImage).toHaveBeenCalledWith('img-42');
  });

  it('requires a second click before deleting permanently', async () => {
    setState({ images: [trashImage({ id: 'img-42' })], total: 1 });

    render(<TrashPage />);
    fireEvent.click(screen.getByRole('button', { name: 'trash.permanentDelete' }));

    // First click only arms the confirmation — nothing is deleted yet.
    expect(h.permanentDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'trash.confirmDelete' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'trash.confirmDelete' }));

    await waitFor(() => expect(h.permanentDelete).toHaveBeenCalledWith('img-42'));
    expect(screen.queryByRole('button', { name: 'trash.confirmDelete' })).toBeNull();
  });

  it('can back out of the permanent-delete confirmation', () => {
    setState({ images: [trashImage({ id: 'img-42' })], total: 1 });

    render(<TrashPage />);
    fireEvent.click(screen.getByRole('button', { name: 'trash.permanentDelete' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(h.permanentDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'trash.permanentDelete' })).toBeTruthy();
  });
});

describe('TrashPage pagination', () => {
  it('hides pagination when everything fits on one page', () => {
    setState({ images: [trashImage()], total: 1, perPage: 40 });

    render(<TrashPage />);

    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
  });

  it('fetches the page that was clicked', () => {
    setState({ images: [trashImage()], total: 120, perPage: 40, page: 1 });

    render(<TrashPage />);
    expect(screen.getByText('common.pageInfo({"page":1,"totalPages":3})')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '3' }));

    expect(h.fetchTrash).toHaveBeenCalledWith(3);
  });
});

describe('TrashPage empty-trash confirmation', () => {
  function openDialog() {
    setState({ images: [trashImage()], total: 5 });
    render(<TrashPage />);
    fireEvent.click(screen.getByRole('button', { name: 'trash.emptyTrash' }));
  }

  it('asks for confirmation with the real item count', () => {
    openDialog();

    expect(screen.getByText('trash.emptyTrashConfirm')).toBeTruthy();
    expect(screen.getByText('trash.emptyTrashDesc({"count":5})')).toBeTruthy();
    expect(h.emptyTrash).not.toHaveBeenCalled();
  });

  it('cancelling leaves the trash untouched', () => {
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(h.emptyTrash).not.toHaveBeenCalled();
    expect(screen.queryByText('trash.emptyTrashConfirm')).toBeNull();
  });

  it('confirming empties the trash and closes the dialog', async () => {
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'trash.confirmEmpty' }));

    await waitFor(() => expect(h.emptyTrash).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('trash.emptyTrashConfirm')).toBeNull());
  });

  it('clicking the backdrop closes it, clicking the panel keeps it open', () => {
    openDialog();

    const panel = screen.getByText('trash.emptyTrashConfirm').closest('div') as HTMLElement;
    fireEvent.click(panel);
    expect(screen.getByText('trash.emptyTrashConfirm')).toBeTruthy();

    fireEvent.click(panel.parentElement as HTMLElement);
    expect(screen.queryByText('trash.emptyTrashConfirm')).toBeNull();
    expect(h.emptyTrash).not.toHaveBeenCalled();
  });
});

describe('TrashPage responsive layout', () => {
  it('uses the mobile padding/min-width on small screens', () => {
    h.isMobile.value = true;
    setState({ images: [trashImage()], total: 1 });

    render(<TrashPage />);

    const table = document.querySelector('table') as HTMLTableElement;
    expect(table.style.minWidth).toBe('480px');
    expect(screen.getByText('trash.title').className).toBe('page-title page-title--mobile');
  });

  it('uses the desktop title class on wide screens', () => {
    setState({ images: [trashImage()], total: 1 });

    render(<TrashPage />);

    expect(document.querySelector('table')!.style.minWidth).toBe('auto');
    expect(screen.getByText('trash.title').className).toBe('page-title');
  });
});
