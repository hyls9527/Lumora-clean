import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { SmartCollectionsPage } from '../SmartCollectionsPage';

vi.mock('../../../lib/api/smartCollections', () => ({
  listSmartCollections: vi.fn(),
  createSmartCollection: vi.fn(),
  updateSmartCollection: vi.fn(),
  deleteSmartCollection: vi.fn(),
  getSmartCollectionImages: vi.fn(),
}));

vi.mock('../../../components/ui/ImageCard', () => ({
  ImageCard: ({ image }: { image: { id: string; fileName: string } }) => (
    <div data-testid={`card-${image.id}`}>{image.fileName}</div>
  ),
}));

vi.mock('../../../components/ui/DetailModal', () => ({
  DetailModal: () => null,
}));

vi.mock('../../../components/ui/ErrorState', () => ({
  ErrorState: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div data-testid="error-state">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry}>重试</button>}
    </div>
  ),
}));

import * as api from '../../../lib/api/smartCollections';

const baseCollection = {
  id: 'c1',
  name: '高评分',
  createdAt: '2025-01-01',
  count: 3,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SmartCollectionsPage', () => {
  beforeEach(() => {
    vi.mocked(api.listSmartCollections).mockResolvedValue([]);
    vi.mocked(api.createSmartCollection).mockResolvedValue({ ...baseCollection, rules: [] });
    vi.mocked(api.updateSmartCollection).mockResolvedValue({ ...baseCollection, rules: [] });
    vi.mocked(api.deleteSmartCollection).mockResolvedValue(undefined);
    vi.mocked(api.getSmartCollectionImages).mockResolvedValue({ items: [], total: 0 });
  });

  it('renders collection list with rule summaries', async () => {
    vi.mocked(api.listSmartCollections).mockResolvedValue([
      {
        ...baseCollection,
        rules: [{ field: 'rating', op: 'gte', value: '4' }],
      },
      {
        id: 'c2',
        name: 'SDXL 作品',
        createdAt: '2025-01-02',
        count: 5,
        rules: [{ field: 'model', op: 'equals', value: 'SDXL' }],
      },
    ]);

    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('高评分')).toBeTruthy();
      expect(screen.getByText('SDXL 作品')).toBeTruthy();
      expect(screen.getByText('评分 ≥ 4')).toBeTruthy();
      expect(screen.getByText('模型 = SDXL')).toBeTruthy();
      expect(screen.getByText('3 张图片')).toBeTruthy();
    });
  });

  it('shows empty state when no collections', async () => {
    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('暂无智能收藏')).toBeTruthy();
    });
  });

  it('shows error state on load failure', async () => {
    vi.mocked(api.listSmartCollections).mockRejectedValue(new Error('db error'));

    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeTruthy();
      expect(screen.getByText('db error')).toBeTruthy();
    });
  });

  it('creates a collection from the editor', async () => {
    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('暂无智能收藏')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('+ 新建收藏'));
    fireEvent.change(screen.getByPlaceholderText('输入收藏名称'), {
      target: { value: '我的收藏' },
    });
    fireEvent.change(screen.getByPlaceholderText('规则值'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(api.createSmartCollection).toHaveBeenCalledWith('我的收藏', [
        { field: 'model', op: 'equals', value: '4' },
      ]);
    });
  });

  it('edits an existing collection with prefilled values', async () => {
    vi.mocked(api.listSmartCollections).mockResolvedValue([
      {
        ...baseCollection,
        rules: [{ field: 'rating', op: 'gte', value: '3' }],
      },
    ]);

    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('高评分')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText('编辑')[0]);
    const nameInput = screen.getByPlaceholderText('输入收藏名称') as HTMLInputElement;
    expect(nameInput.value).toBe('高评分');
    fireEvent.change(nameInput, { target: { value: '高分精选' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(api.updateSmartCollection).toHaveBeenCalledWith(
        'c1',
        '高分精选',
        [{ field: 'rating', op: 'gte', value: '3' }],
      );
    });
  });

  it('deletes a collection after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.listSmartCollections).mockResolvedValue([
      { ...baseCollection, rules: [{ field: 'format', op: 'equals', value: 'png' }] },
    ]);

    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('高评分')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('删除'));

    await waitFor(() => {
      expect(api.deleteSmartCollection).toHaveBeenCalledWith('c1');
    });
  });

  it('opens detail view and loads matching images', async () => {
    vi.mocked(api.listSmartCollections).mockResolvedValue([
      { ...baseCollection, rules: [{ field: 'format', op: 'equals', value: 'png' }] },
    ]);
    vi.mocked(api.getSmartCollectionImages).mockResolvedValue({
      items: [
        {
          id: 'img-1',
          filePath: '/a.png',
          fileName: 'a.png',
          fileSizeKb: 10,
          width: 512,
          height: 512,
          format: 'png',
          createdAt: '2025-01-01',
          rating: 0,
          favorite: false,
          model: '',
          prompt: '',
          tags: [],
        },
      ],
      total: 1,
    });

    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('高评分')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('高评分'));

    await waitFor(() => {
      expect(api.getSmartCollectionImages).toHaveBeenCalledWith('c1', 1, 40);
      expect(screen.getByTestId('card-img-1')).toBeTruthy();
    });
    expect(screen.getByText('1 张图片')).toBeTruthy();
  });

  it('paginates through detail images', async () => {
    vi.mocked(api.listSmartCollections).mockResolvedValue([
      { ...baseCollection, rules: [], count: 45 },
    ]);
    vi.mocked(api.getSmartCollectionImages)
      .mockResolvedValueOnce({ items: [], total: 45 })
      .mockResolvedValueOnce({ items: [], total: 45 });

    render(<SmartCollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText('高评分')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('高评分'));

    await waitFor(() => {
      expect(api.getSmartCollectionImages).toHaveBeenCalledWith('c1', 1, 40);
    });

    fireEvent.click(screen.getByText('下一页'));

    await waitFor(() => {
      expect(api.getSmartCollectionImages).toHaveBeenCalledWith('c1', 2, 40);
    });
  });
});
