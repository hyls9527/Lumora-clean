import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { GalleryPage } from '../GalleryPage';
import { useFilterStore } from '../../../stores/filterStore';
import type { ImageRecord } from '../../../types/image';

const h = vi.hoisted(() => ({
  t: vi.fn((key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}(${JSON.stringify(opts)})` : key,
  ),
  state: {} as Record<string, unknown>,
  selection: {} as Record<string, unknown>,
  actions: {} as Record<string, unknown>,
  trash: {} as Record<string, unknown>,
  addToast: vi.fn(),
  searchSimilar: vi.fn(),
  generate: vi.fn(),
  batchAutoTag: vi.fn(),
  fetchImages: vi.fn().mockResolvedValue(undefined),
  loadMore: vi.fn().mockResolvedValue(undefined),
  nav: { config: null as null | { activeStage: string; stages: Array<Record<string, (...a: unknown[]) => void>> } },
  isMobile: { value: false },
}));

vi.mock('../../../stores/imageStore', () => ({
  // The page reads state (data) and actions (fetchImages/loadMore) off the
  // same hook; both bags are filled per test through h.state/h.actions.
  useImageStore: Object.assign(() => h.state, {
    getState: () => ({ ...h.state, ...h.actions }),
  }),
}));

vi.mock('../../../hooks/useSelection', () => ({
  useSelection: () => h.selection,
}));

vi.mock('../../../hooks/useImageActions', () => ({
  useImageActions: () => h.actions,
}));

vi.mock('../../../stores/trashStore', () => ({
  useTrashStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(h.trash) : h.trash,
}));

vi.mock('../../../stores/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: h.addToast }) },
}));

vi.mock('../../../stores/imageSearchStore', () => ({
  useImageSearchStore: { getState: () => ({ search: h.searchSimilar }) },
}));

vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: { getState: () => ({ generate: h.generate }) },
}));

vi.mock('../../../lib/api/ai', () => ({
  batchAutoTag: h.batchAutoTag,
}));

vi.mock('../../../hooks/useKeyboardNav', () => ({
  useKeyboardNav: (config: typeof h.nav.config) => {
    h.nav.config = config;
  },
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => h.isMobile.value,
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: h.t }),
  t: h.t,
}));

vi.mock('../../../components/ui/ImageCard', () => ({
  ImageCard: ({
    image,
    focused,
    onOpen,
    onClick,
  }: {
    image: ImageRecord;
    focused: boolean;
    onOpen: () => void;
    onClick: () => void;
  }) => (
    <div data-testid={`card-${image.id}`} data-focused={String(focused)} onClick={onClick}>
      <button type="button" data-testid={`open-${image.id}`} onClick={onOpen}>
        open
      </button>
    </div>
  ),
}));

vi.mock('../../../components/ui/DetailModal', () => ({
  DetailModal: ({
    image,
    onClose,
    onPrev,
    onNext,
    onToggleFavorite,
    onSetRating,
    onSearchSimilar,
  }: {
    image: ImageRecord | null;
    onClose: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onToggleFavorite?: (id: string) => void;
    onSetRating?: (id: string, rating: number) => void;
    onSearchSimilar?: (id: string) => void;
  }) =>
    image ? (
      <div data-testid="detail-modal" data-image-id={image.id}>
        <button type="button" onClick={onClose}>
          detail-close
        </button>
        <button type="button" onClick={onPrev}>
          detail-prev
        </button>
        <button type="button" onClick={onNext}>
          detail-next
        </button>
        <button type="button" onClick={() => onToggleFavorite?.(image.id)}>
          detail-favorite
        </button>
        <button type="button" onClick={() => onSetRating?.(image.id, 5)}>
          detail-rate
        </button>
        <button type="button" onClick={() => onSearchSimilar?.(image.id)}>
          detail-similar
        </button>
      </div>
    ) : null,
}));

vi.mock('../../../components/ui/LoadingSkeleton', () => ({
  GridSkeleton: () => <div data-testid="loading-skeleton" />,
}));

vi.mock('../../../components/ui/LazyLoad', () => ({
  LazyLoad: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/InfiniteScroll', () => ({
  InfiniteScroll: ({
    children,
    hasMore,
  }: {
    children: React.ReactNode;
    hasMore: boolean;
  }) => (
    <div data-testid="infinite-scroll" data-hasmore={String(hasMore)}>
      {children}
    </div>
  ),
}));

vi.mock('../../../components/rename/RenameDialog', () => ({
  RenameDialog: ({ open, imageIds, onComplete }: { open: boolean; imageIds: string[]; onComplete: () => void }) =>
    open ? (
      <div data-testid="rename-dialog" data-ids={imageIds.join(',')}>
        <button type="button" onClick={onComplete}>
          rename-complete
        </button>
      </div>
    ) : null,
}));

vi.mock('../../../components/convert/ConvertDialog', () => ({
  ConvertDialog: ({ open, imageIds, onComplete }: { open: boolean; imageIds: string[]; onComplete: () => void }) =>
    open ? (
      <div data-testid="convert-dialog" data-ids={imageIds.join(',')}>
        <button type="button" onClick={onComplete}>
          convert-complete
        </button>
      </div>
    ) : null,
}));

function image(id: string, overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    id,
    filePath: `C:/lib/${id}.png`,
    fileName: `${id}.png`,
    fileSizeKb: 100,
    width: 512,
    height: 512,
    format: 'png',
    createdAt: '2025-01-01',
    rating: 0,
    favorite: false,
    model: 'Flux',
    prompt: 'a fox',
    tags: [],
    ...overrides,
  };
}

interface StateOverrides {
  images?: ImageRecord[];
  loading?: boolean;
  error?: string | null;
  page?: number;
  total?: number;
  perPage?: number;
  pageMode?: string;
}

function setState(overrides: StateOverrides = {}) {
  const images = overrides.images ?? [];
  h.state = {
    filters: { mode: 'creator', view: 'grid', sortBy: 'time', modelFilter: 'all' },
    setSortBy: vi.fn(),
    setModelFilter: vi.fn(),
    setView: vi.fn(),
    getFilteredImages: () => images,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    fetchImages: h.fetchImages,
    loadMore: h.loadMore,
    page: overrides.page ?? 1,
    total: overrides.total ?? images.length,
    perPage: overrides.perPage ?? 40,
    pageMode: overrides.pageMode ?? 'infinite',
  };
}

function stageHandlers(id: 'browse' | 'detail'){
  const stage = h.nav.config?.stages.find((s: { id?: string }) => (s as { id?: string }).id === id);
  if (!stage) throw new Error('stage not registered: ' + id);
  return stage as unknown as Record<string, (...args: unknown[]) => void>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  h.isMobile.value = false;
  h.fetchImages = vi.fn().mockResolvedValue(undefined);
  h.loadMore = vi.fn().mockResolvedValue(undefined);
  h.selection = { selectedIds: new Set<string>(), toggleSelect: vi.fn(), clearSelection: vi.fn() };
  h.actions = { toggleFavorite: vi.fn(), setRating: vi.fn() };
  h.trash = { softDeleteImage: vi.fn().mockResolvedValue(undefined), batchSoftDelete: vi.fn().mockResolvedValue(2) };
  h.batchAutoTag.mockResolvedValue({ processed: 2, failed: 0 });
  h.generate.mockResolvedValue(undefined);
  h.nav.config = null;
  useFilterStore.setState({ criteria: {} });
  setState();
});

describe('GalleryPage mount', () => {
  it('debounces the initial fetch so filter typing does not spam the backend', async () => {
    vi.useFakeTimers();
    render(<GalleryPage />);

    expect(h.fetchImages).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(h.fetchImages).toHaveBeenCalledWith(1);
  });
});

describe('GalleryPage toolbar', () => {
  it('switches the grid/list view through the store', () => {
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: '列表' }));

    expect(h.state.setView).toHaveBeenCalledWith('list');
  });

  it('applies and clears an explicit column count', () => {
    setState({ images: [image('a')] });
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: '3列' }));
    expect(document.querySelector('.gallery-grid')!.getAttribute('style')).toContain('column-count: 3');

    fireEvent.click(screen.getByRole('button', { name: '3列' }));
    expect(document.querySelector('.gallery-grid')!.getAttribute('style') ?? '').not.toContain('column-count');
  });

  it('sorts and filters through the store', () => {
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: '评分' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flux' }));

    expect(h.state.setSortBy).toHaveBeenCalledWith('rating');
    expect(h.state.setModelFilter).toHaveBeenCalledWith('Flux');
  });
});

describe('GalleryPage status, empty and error states', () => {
  it('reports loading and the total count in the status bar', () => {
    setState({ loading: true, total: 7 });
    render(<GalleryPage />);

    expect(screen.getByText('common.loadingMore')).toBeTruthy();
    expect(screen.getByText('common.totalImages({"total":7})')).toBeTruthy();
  });

  it('reports a connected database when idle', () => {
    render(<GalleryPage />);

    expect(screen.getByText('common.dbConnected')).toBeTruthy();
  });

  it('shows the empty-library state instead of a grid', () => {
    render(<GalleryPage />);

    expect(screen.getByText('图库尚空')).toBeTruthy();
    expect(screen.queryByTestId('infinite-scroll')).toBeNull();
  });

  it('retries the current page after an error', () => {
    setState({ error: '数据库被锁定', page: 2 });
    render(<GalleryPage />);

    expect(screen.getByRole('alert').textContent).toContain('数据库被锁定');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(h.fetchImages).toHaveBeenCalledWith(2);
  });

  it('only requests more pages while the library has more to give', () => {
    setState({ images: [image('a')], total: 5, pageMode: 'infinite' });
    const { unmount } = render(<GalleryPage />);
    expect(screen.getByTestId('infinite-scroll').dataset.hasmore).toBe('true');

    unmount();
    setState({ images: [image('a')], total: 5, pageMode: 'explicit' });
    render(<GalleryPage />);
    // An explicit page request must not be extended by infinite scroll.
    expect(screen.getByTestId('infinite-scroll').dataset.hasmore).toBe('false');
  });
});

describe('GalleryPage pagination', () => {
  it('requests an explicit page when its number is clicked', () => {
    setState({ images: [image('a')], total: 120, perPage: 40, page: 1 });
    render(<GalleryPage />);

    expect(screen.getByText('common.pageInfo({"page":1,"totalPages":3})')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(h.fetchImages).toHaveBeenCalledWith(2, { explicit: true });
  });
});

describe('GalleryPage cards and focus', () => {
  it('renders one card per image and focuses the clicked one', () => {
    setState({ images: [image('a'), image('b'), image('c')] });
    render(<GalleryPage />);

    expect(screen.getByTestId('card-a').dataset.focused).toBe('false');
    fireEvent.click(screen.getByTestId('card-b'));

    expect(screen.getByTestId('card-b').dataset.focused).toBe('true');
    expect(screen.getByTestId('card-a').dataset.focused).toBe('false');
  });

  it('opens the detail modal from a card', () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    fireEvent.click(screen.getByTestId('open-b'));

    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('b');
  });
});

describe('GalleryPage keyboard navigation', () => {
  it('moves the focus down and up within the loaded page', () => {
    setState({ images: [image('a'), image('b'), image('c')] });
    render(<GalleryPage />);

    act(() => stageHandlers('browse').onArrowDown());
    expect(screen.getByTestId('card-a').dataset.focused).toBe('true');

    act(() => stageHandlers('browse').onArrowDown());
    expect(screen.getByTestId('card-b').dataset.focused).toBe('true');

    act(() => stageHandlers('browse').onArrowUp());
    expect(screen.getByTestId('card-a').dataset.focused).toBe('true');

    // Clamped at the top.
    act(() => stageHandlers('browse').onArrowUp());
    expect(screen.getByTestId('card-a').dataset.focused).toBe('true');
  });

  it('never focuses past the last loaded image', () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    act(() => {
      for (let i = 0; i < 5; i++) stageHandlers('browse').onArrowDown();
    });

    expect(screen.getByTestId('card-b').dataset.focused).toBe('true');
  });

  it('jumps a whole column at the 1024px breakpoint', () => {
    vi.stubGlobal('innerWidth', 1200); // 3 masonry columns
    setState({ images: [image('a'), image('b'), image('c'), image('d')] });
    render(<GalleryPage />);

    act(() => stageHandlers('browse').onArrowRight());

    // -1 + 3 columns lands on the 3rd card, not the 1st.
    expect(screen.getByTestId('card-c').dataset.focused).toBe('true');

    act(() => stageHandlers('browse').onArrowLeft());
    expect(screen.getByTestId('card-a').dataset.focused).toBe('true');
    vi.unstubAllGlobals();
  });

  it('uses the wide-screen column count at 1440px and the narrow one below 480px', () => {
    vi.stubGlobal('innerWidth', 1500); // 4 columns
    setState({ images: [image('a'), image('b'), image('c'), image('d')] });
    const first = render(<GalleryPage />);

    act(() => stageHandlers('browse').onArrowRight());
    expect(screen.getByTestId('card-d').dataset.focused).toBe('true');

    first.unmount();
    vi.stubGlobal('innerWidth', 400); // 1 column
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowRight());
    expect(screen.getByTestId('card-a').dataset.focused).toBe('true');
    vi.unstubAllGlobals();
  });

  it('honours an explicit column count for left/right jumps', () => {
    vi.stubGlobal('innerWidth', 1200);
    setState({ images: [image('a'), image('b'), image('c'), image('d')] });
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: '2列' }));
    act(() => stageHandlers('browse').onArrowRight());

    expect(screen.getByTestId('card-b').dataset.focused).toBe('true');
    vi.unstubAllGlobals();
  });

  it('opens the focused image with Enter and toggles selection with Space', () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    act(() => stageHandlers('browse').onArrowDown());
    act(() => stageHandlers('browse').onSpace());

    expect(h.selection.toggleSelect).toHaveBeenCalledWith('a');

    act(() => stageHandlers('browse').onEnter());
    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('a');
  });

  it('ignores Enter/Space/Delete/Favorite/Rate when nothing is focused', () => {
    setState({ images: [image('a')] });
    render(<GalleryPage />);

    act(() => {
      stageHandlers('browse').onEnter();
      stageHandlers('browse').onSpace();
      stageHandlers('browse').onDelete();
      stageHandlers('browse').onFavorite();
      stageHandlers('browse').onRate(4);
    });

    expect(screen.queryByTestId('detail-modal')).toBeNull();
    expect(h.selection.toggleSelect).not.toHaveBeenCalled();
    expect(h.trash.softDeleteImage).not.toHaveBeenCalled();
    expect(h.actions.toggleFavorite).not.toHaveBeenCalled();
    expect(h.actions.setRating).not.toHaveBeenCalled();
  });

  it('soft-deletes the focused image and refreshes the gallery', async () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());

    await act(async () => {
      stageHandlers('browse').onDelete();
    });

    expect(h.trash.softDeleteImage).toHaveBeenCalledWith('a');
    await waitFor(() => expect(h.fetchImages).toHaveBeenCalledTimes(1));
  });

  it('reports a failed delete instead of silently dropping it', async () => {
    const boom = new Error('file is locked');
    h.trash.softDeleteImage = vi.fn().mockRejectedValue(boom);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setState({ images: [image('a')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());

    await act(async () => {
      stageHandlers('browse').onDelete();
    });

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Failed to delete image:', {
        id: 'a',
        err: boom,
      }),
    );
    errorSpy.mockRestore();
  });

  it('toggles favorite and rating on the focused image', () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());

    act(() => stageHandlers('browse').onFavorite());
    act(() => stageHandlers('browse').onRate(4));

    expect(h.actions.toggleFavorite).toHaveBeenCalledWith('a');
    expect(h.actions.setRating).toHaveBeenCalledWith('a', 4);
  });

  it('clears the selection and the focus on Escape', () => {
    h.selection.selectedIds = new Set(['a']);
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());

    act(() => stageHandlers('browse').onEscape());

    expect(h.selection.clearSelection).toHaveBeenCalled();
    expect(screen.getByTestId('card-a').dataset.focused).toBe('false');
  });
});

describe('GalleryPage detail stage', () => {
  it('switches the active keyboard stage while the modal is open', () => {
    setState({ images: [image('a')] });
    render(<GalleryPage />);
    expect(h.nav.config?.activeStage).toBe('browse');

    act(() => stageHandlers('browse').onArrowDown());
    act(() => stageHandlers('browse').onEnter());

    expect(h.nav.config?.activeStage).toBe('detail');
  });

  it('moves to the next/previous image and clamps at both ends', () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());
    act(() => stageHandlers('browse').onEnter());

    act(() => stageHandlers('detail').onArrowRight());
    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('b');

    act(() => stageHandlers('detail').onArrowRight());
    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('b');

    act(() => stageHandlers('detail').onArrowLeft());
    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('a');

    act(() => stageHandlers('detail').onArrowLeft());
    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('a');
  });

  it('closes the modal on Escape', () => {
    setState({ images: [image('a')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());
    act(() => stageHandlers('browse').onEnter());

    act(() => stageHandlers('detail').onEscape());

    expect(screen.queryByTestId('detail-modal')).toBeNull();
  });

  it('wires the modal buttons to the real handlers', () => {
    setState({ images: [image('a')] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());
    act(() => stageHandlers('browse').onEnter());

    fireEvent.click(screen.getByRole('button', { name: 'detail-favorite' }));
    fireEvent.click(screen.getByRole('button', { name: 'detail-rate' }));

    expect(h.actions.toggleFavorite).toHaveBeenCalledWith('a');
    expect(h.actions.setRating).toHaveBeenCalledWith('a', 5);

    fireEvent.click(screen.getByRole('button', { name: 'detail-close' }));
    expect(screen.queryByTestId('detail-modal')).toBeNull();
  });

  it('starts a similar-image search and closes the modal', () => {
    setState({ images: [image('a', { filePath: 'C:/lib/a.png' })] });
    render(<GalleryPage />);
    act(() => stageHandlers('browse').onArrowDown());
    act(() => stageHandlers('browse').onEnter());

    fireEvent.click(screen.getByRole('button', { name: 'detail-similar' }));

    expect(h.searchSimilar).toHaveBeenCalledWith('a', 'C:/lib/a.png');
    expect(screen.queryByTestId('detail-modal')).toBeNull();
  });

  it('opens the image announced by the lumora:selectImage event', () => {
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    act(() => {
      window.dispatchEvent(new CustomEvent('lumora:selectImage', { detail: image('off-page') }));
    });

    // The image is not part of the current page, so the modal keeps the
    // snapshot instead of dropping the selection (F-7 fallback).
    expect(screen.getByTestId('detail-modal').dataset.imageId).toBe('off-page');
  });
});

describe('GalleryPage batch actions', () => {
  function withSelection(ids: string[]) {
    h.selection = {
      selectedIds: new Set(ids),
      toggleSelect: vi.fn(),
      clearSelection: vi.fn(),
    };
  }

  it('hides the batch toolbar when nothing is selected', () => {
    setState({ images: [image('a')] });
    render(<GalleryPage />);

    expect(screen.queryByRole('button', { name: 'delete' })).toBeNull();
  });

  it('batch deletes the selection and reloads the current page', async () => {
    withSelection(['a', 'b']);
    setState({ images: [image('a'), image('b')], page: 2 });
    render(<GalleryPage />);

    expect(screen.getByText('selected({"count":2})')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    });

    expect(h.trash.batchSoftDelete).toHaveBeenCalledWith(['a', 'b']);
    expect(h.selection.clearSelection).toHaveBeenCalled();
    expect(h.fetchImages).toHaveBeenCalledWith(2);
  });

  it('surfaces a batch delete failure as a toast', async () => {
    h.trash.batchSoftDelete = vi.fn().mockRejectedValue(new Error('磁盘已满'));
    withSelection(['a']);
    setState({ images: [image('a')] });
    render(<GalleryPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    });

    expect(h.addToast).toHaveBeenCalledWith('error', '磁盘已满');
  });

  it('runs AI auto-tagging over the selection', async () => {
    withSelection(['a', 'b']);
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'aiTag' }));
    });

    expect(h.batchAutoTag).toHaveBeenCalledWith(['a', 'b']);
    expect(h.selection.clearSelection).toHaveBeenCalled();
  });

  it('generates embeddings only for the selected images', async () => {
    withSelection(['b']);
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'embed' }));
    });

    expect(h.generate).toHaveBeenCalledWith([expect.objectContaining({ id: 'b' })]);
    expect(h.selection.clearSelection).toHaveBeenCalled();
  });

  it('opens the rename dialog for the selection and refreshes on completion', async () => {
    withSelection(['a', 'b']);
    setState({ images: [image('a'), image('b')] });
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'rename' }));
    expect(screen.getByTestId('rename-dialog').dataset.ids).toBe('a,b');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'rename-complete' }));
    });

    expect(screen.queryByTestId('rename-dialog')).toBeNull();
    expect(h.selection.clearSelection).toHaveBeenCalled();
    expect(h.fetchImages).toHaveBeenCalled();
  });

  it('opens the convert dialog for the selection and refreshes on completion', async () => {
    withSelection(['a']);
    setState({ images: [image('a')] });
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'convert' }));
    expect(screen.getByTestId('convert-dialog').dataset.ids).toBe('a');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'convert-complete' }));
    });

    expect(screen.queryByTestId('convert-dialog')).toBeNull();
    expect(h.fetchImages).toHaveBeenCalled();
  });

  it('cancels the selection', () => {
    withSelection(['a']);
    setState({ images: [image('a')] });
    render(<GalleryPage />);

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(h.selection.clearSelection).toHaveBeenCalled();
  });
});
