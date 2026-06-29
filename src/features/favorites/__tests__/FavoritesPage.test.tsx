import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FavoritesPage } from '../FavoritesPage';
import { useImageStore } from '../../../stores/imageStore';

// Mock child components
vi.mock('../../../components/ui/ImageCard', () => ({
  ImageCard: ({ image }: { image: { id: string; fileName: string } }) => (
    <div data-testid={`card-${image.id}`}>{image.fileName}</div>
  ),
}));

vi.mock('../../../components/ui/DetailModal', () => ({
  DetailModal: () => null,
}));

const baseImage = {
  filePath: '/test.png', fileSizeKb: 100, width: 512, height: 512,
  format: 'png' as const, createdAt: '2025-01-01', model: 'SDXL', prompt: 'test', tags: [],
};

afterEach(() => {
  cleanup();
});

describe('FavoritesPage', () => {
  it('renders only favorite images', () => {
    useImageStore.setState({
      images: [
        { ...baseImage, id: 'img-1', fileName: 'fav1.png', rating: 5, favorite: true },
        { ...baseImage, id: 'img-2', fileName: 'notfav.png', rating: 3, favorite: false },
        { ...baseImage, id: 'img-3', fileName: 'fav2.png', rating: 4, favorite: true },
      ],
      loading: false, error: null, fetchImages: vi.fn(),
    } as any);

    render(<FavoritesPage />);

    expect(screen.getByTestId('card-img-1')).toBeTruthy();
    expect(screen.queryByTestId('card-img-2')).toBeNull();
    expect(screen.getByTestId('card-img-3')).toBeTruthy();
  });

  it('shows empty state when no favorites', () => {
    useImageStore.setState({
      images: [
        { ...baseImage, id: 'img-1', fileName: 'a.png', rating: 0, favorite: false },
      ],
      loading: false, error: null, fetchImages: vi.fn(),
    } as any);

    render(<FavoritesPage />);

    expect(screen.getByText('暂无收藏图片')).toBeTruthy();
  });

  it('shows correct count in bottom bar', () => {
    useImageStore.setState({
      images: [
        { ...baseImage, id: 'img-1', fileName: 'a.png', rating: 5, favorite: true },
        { ...baseImage, id: 'img-2', fileName: 'b.png', rating: 3, favorite: false },
        { ...baseImage, id: 'img-3', fileName: 'c.png', rating: 4, favorite: true },
      ],
      loading: false, error: null, fetchImages: vi.fn(),
    } as any);

    render(<FavoritesPage />);

    expect(screen.getByText('2 张收藏')).toBeTruthy();
  });

  it('calls fetchImages on mount', () => {
    const mockFetch = vi.fn();
    useImageStore.setState({
      images: [], loading: false, error: null, fetchImages: mockFetch,
    } as any);

    render(<FavoritesPage />);

    expect(mockFetch).toHaveBeenCalledWith(1);
  });
});
