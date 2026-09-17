import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ImageCard } from '../ImageCard';

// 1x1 transparent PNG used as a fake thumbnail payload
const MOCK_THUMB_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Mock the tauri lib (invoke serves thumbnails via base64 command)
vi.mock('../../../lib/tauri', () => ({
  convertFileSrc: vi.fn((path: string) => Promise.resolve(`asset://localhost/${encodeURIComponent(path)}`)),
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'get_thumbnail_base64_cmd') return Promise.resolve(MOCK_THUMB_B64);
    return Promise.resolve(null);
  }),
}));

// Mock the hooks
vi.mock('../../../hooks/useImageActions', () => ({
  useImageActions: () => ({
    toggleFavorite: vi.fn(),
    setRating: vi.fn(),
  }),
}));

// Mock the stores
vi.mock('../../../stores/imageStore', () => ({
  useImageStore: vi.fn((selector) => {
    const state = {
      fetchImages: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/trashStore', () => ({
  useTrashStore: vi.fn((selector) => {
    const state = {
      softDeleteImage: vi.fn().mockResolvedValue(undefined),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/embeddingStore', () => ({
  useEmbeddingStore: vi.fn((selector) => {
    const state = {
      statusMap: {},
      fetchStatus: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

const MOCK_IMAGE = {
  id: 'img-1',
  filePath: '/test/image.png',
  fileName: 'image.png',
  fileSizeKb: 100,
  width: 800,
  height: 600,
  format: 'png' as const,
  createdAt: '2025-01-01T00:00:00Z',
  rating: 3,
  favorite: false,
  model: 'stable-diffusion',
  prompt: 'A beautiful landscape',
  tags: ['nature', 'landscape'],
};

afterEach(() => {
  cleanup();
});

describe('ImageCard — 灯箱印样', () => {
  it('renders image as primary content', async () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    expect(await screen.findByAltText('image.png')).toBeDefined();
  });

  it('renders model name in hover chrome', () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    expect(screen.getByText('stable-diffusion')).toBeDefined();
  });

  it('does not render prompt on the plate (lives in lightbox marginalia)', () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    expect(screen.queryByText('A beautiful landscape')).toBeNull();
  });

  it('does not render tags on the plate (lives in lightbox marginalia)', () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    expect(screen.queryByText('nature')).toBeNull();
    expect(screen.queryByText('landscape')).toBeNull();
  });

  it('renders favorite button with correct label', () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    expect(screen.getByLabelText('收藏')).toBeDefined();
  });

  it('renders delete button', () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    expect(screen.getByLabelText('删除')).toBeDefined();
  });

  it('renders rating component', () => {
    render(<ImageCard image={MOCK_IMAGE} />);
    const ratingButtons = screen.getAllByLabelText(/梅花印/);
    expect(ratingButtons.length).toBe(5);
  });

  it('shows favorite corner stamp when favorited', () => {
    const { container } = render(<ImageCard image={{ ...MOCK_IMAGE, favorite: true }} />);
    expect(container.querySelector('.image-card__stamp--fav')).not.toBeNull();
  });

  it('hides favorite corner stamp when not favorited', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} />);
    expect(container.querySelector('.image-card__stamp--fav')).toBeNull();
  });

  it('applies focused CSS class when focused', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} focused />);
    const card = container.firstChild as HTMLElement;
    expect(card.classList.contains('image-card--focused')).toBe(true);
  });
});
