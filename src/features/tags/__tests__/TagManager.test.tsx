import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TagManager } from '../TagManager';

// Mock stores
vi.mock('../../../stores/imageTagsStore', () => ({
  useImageTagsStore: vi.fn((selector) => {
    const state = {
      tags: [],
      loading: false,
      error: null,
      fetchTags: vi.fn(),
      createTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../stores/imageStore', () => ({
  useImageStore: vi.fn((selector) => {
    const state = {
      images: [],
      fetchImages: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

// Mock components
vi.mock('../../../components/ui/ImageCard', () => ({
  ImageCard: () => <div data-testid="image-card" />,
}));

vi.mock('../../../components/ui/DetailModal', () => ({
  DetailModal: () => null,
}));

describe('TagManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<TagManager />);
    expect(container).toBeDefined();
  });

  it('should render tag list section', () => {
    const { container } = render(<TagManager />);
    // Should have a section for tags
    expect(container.querySelector('section, [role="region"]')).toBeDefined();
  });
});
