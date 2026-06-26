import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ImageCard } from '../ImageCard';

// Mock the stores
vi.mock('../../../stores/imageStore', () => ({
  useImageStore: vi.fn((selector) => {
    const state = {
      toggleFavorite: vi.fn(),
      setRating: vi.fn(),
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

  it('has correct border radius for card', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} />);

    const card = container.firstChild as HTMLElement;
    expect(card.style.borderRadius).toBe('2px');
  });

  it('has 200ms transition', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} />);

    const card = container.firstChild as HTMLElement;
    expect(card.style.transition).toContain('200ms');
  });

  it('applies focused style when focused', () => {
    const { container } = render(<ImageCard image={MOCK_IMAGE} focused />);

    const card = container.firstChild as HTMLElement;
    expect(card.style.border).toContain('rgb(122, 92, 18)');
  });
});
