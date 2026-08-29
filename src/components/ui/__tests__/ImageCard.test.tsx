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

describe('ImageCard', () => {
  it('renders image dimensions', () => {
    render(<ImageCard image={MOCK_IMAGE} />);

    expect(screen.getByText('800×600')).toBeDefined();
  });

  it('renders model name', () => {
    render(<ImageCard image={MOCK_IMAGE} />);

    expect(screen.getByText('stable-diffusion')).toBeDefined();
  });

  it('renders prompt excerpt', () => {
    render(<ImageCard image={MOCK_IMAGE} />);

    expect(screen.getByText('A beautiful landscape')).toBeDefined();
  });

  it('renders tags', () => {
    render(<ImageCard image={MOCK_IMAGE} />);

    expect(screen.getByText('nature')).toBeDefined();
    expect(screen.getByText('landscape')).toBeDefined();
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

    // Rating renders 5 plum stamp buttons
    const ratingButtons = screen.getAllByLabelText(/梅花印/);
    expect(ratingButtons.length).toBe(5);
  });

  it('has correct border radius and transition via CSS class', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} />);

    const card = container.firstChild as HTMLElement;
    expect(card.classList.contains('image-card')).toBe(true);
  });

  it('applies focused CSS class when focused', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} focused />);

    const card = container.firstChild as HTMLElement;
    expect(card.classList.contains('image-card--focused')).toBe(true);
  });

  it('loads a resized thumbnail via the base64 command (not the full image)', async () => {
    render(<ImageCard image={MOCK_IMAGE} />);

    // Wait for async thumbnail invoke to resolve
    const img = await screen.findByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toContain(`data:image/png;base64,${MOCK_THUMB_B64}`);
  });

  it('renders img with alt text from fileName', async () => {
    render(<ImageCard image={MOCK_IMAGE} />);

    const img = await screen.findByRole('img');
    expect(img.getAttribute('alt')).toBe('image.png');
  });
});
