import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TrashPage } from '../TrashPage';

// Mock the store
vi.mock('../../../stores/trashStore', () => ({
  useTrashStore: vi.fn((selector) => {
    const state = {
      images: [],
      loading: false,
      error: null,
      fetchTrash: vi.fn(),
      restoreImage: vi.fn(),
      permanentDelete: vi.fn(),
      emptyTrash: vi.fn(),
      page: 1,
      total: 0,
      perPage: 40,
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
vi.mock('../../../components/ui/LoadingSkeleton', () => ({
  GridSkeleton: () => <div data-testid="loading-skeleton" />,
}));

vi.mock('../../../components/ui/ErrorState', () => ({
  ErrorState: ({ message }: { message: string }) => (
    <div data-testid="error-state">{message}</div>
  ),
}));

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

describe('TrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<TrashPage />);
    expect(container).toBeDefined();
  });

  it('should render empty state when no images', () => {
    const { container } = render(<TrashPage />);
    // Should show empty state or message
    expect(container.textContent).toContain('trash');
  });
});
