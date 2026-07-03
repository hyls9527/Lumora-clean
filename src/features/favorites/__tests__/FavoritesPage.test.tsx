import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { FavoritesPage } from '../FavoritesPage';

// Mock the API layer
vi.mock('../../../lib/api/images', () => ({
  listFavorites: vi.fn(),
}));

// Mock child components
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

import * as api from '../../../lib/api/images';

const baseImage = {
  filePath: '/test.png', fileSizeKb: 100, width: 512, height: 512,
  format: 'png' as const, createdAt: '2025-01-01', model: 'SDXL', prompt: 'test', tags: [],
};

afterEach(() => {
  cleanup();
});

describe('FavoritesPage', () => {
  it('calls listFavorites API on mount instead of iterating all pages', async () => {
    vi.mocked(api.listFavorites).mockResolvedValue([]);
    render(<FavoritesPage />);
    await waitFor(() => {
      expect(api.listFavorites).toHaveBeenCalledTimes(1);
    });
  });

  it('renders only favorite images from API', async () => {
    const mockFavs = [
      { ...baseImage, id: 'img-1', fileName: 'fav1.png', rating: 5, favorite: true },
      { ...baseImage, id: 'img-3', fileName: 'fav2.png', rating: 4, favorite: true },
    ];
    vi.mocked(api.listFavorites).mockResolvedValue(mockFavs);

    render(<FavoritesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('card-img-1')).toBeTruthy();
      expect(screen.getByTestId('card-img-3')).toBeTruthy();
    });
  });

  it('shows empty state when no favorites', async () => {
    vi.mocked(api.listFavorites).mockResolvedValue([]);

    render(<FavoritesPage />);

    await waitFor(() => {
      expect(screen.getByText('暂无收藏图片')).toBeTruthy();
    });
  });

  it('shows correct count in bottom bar', async () => {
    const mockFavs = [
      { ...baseImage, id: 'img-1', fileName: 'a.png', rating: 5, favorite: true },
      { ...baseImage, id: 'img-3', fileName: 'c.png', rating: 4, favorite: true },
    ];
    vi.mocked(api.listFavorites).mockResolvedValue(mockFavs);

    render(<FavoritesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 张收藏')).toBeTruthy();
    });
  });

  it('shows error state on API failure', async () => {
    vi.mocked(api.listFavorites).mockRejectedValue(new Error('network error'));

    render(<FavoritesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeTruthy();
      expect(screen.getByText('network error')).toBeTruthy();
    });
  });
});
