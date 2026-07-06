import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AiAnalysisSection } from '../AiAnalysisSection';

vi.mock('../../../../stores/aiAnalysisStore', () => ({
  useAiAnalysisStore: vi.fn(),
}));

vi.mock('../../../../stores/imageTagsStore', () => ({
  useImageTagsStore: vi.fn(),
}));

vi.mock('../../../../lib/api/images', () => ({
  createTag: vi.fn(),
  listTags: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => opts ? `${k}:${JSON.stringify(opts)}` : k }),
}));

import { useAiAnalysisStore } from '../../../../stores/aiAnalysisStore';
import { useImageTagsStore } from '../../../../stores/imageTagsStore';

const baseAnalysisStore = {
  results: {} as Record<string, unknown>,
  history: {} as Record<string, unknown[]>,
  analyzingId: null as string | null,
  acceptedTags: {} as Record<string, string[]>,
  rejectedTags: {} as Record<string, string[]>,
  analyze: vi.fn(),
  loadHistory: vi.fn(),
  applyTags: vi.fn(),
  acceptTag: vi.fn(),
  rejectTag: vi.fn(),
};

const baseTagsStore = {
  tags: [] as string[],
  addTag: vi.fn(),
};

function mockAnalysis(overrides: Record<string, unknown> = {}) {
  const store = { ...baseAnalysisStore, ...overrides };
  (useAiAnalysisStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: Function) => selector(store));
}

describe('AiAnalysisSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockAnalysis();
    (useImageTagsStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: Function) => selector(baseTagsStore));
  });

  it('should render analyze button', () => {
    render(<AiAnalysisSection imageId="img-1" />);
    expect(screen.getByText('analyze')).toBeTruthy();
  });

  it('should call analyze when button clicked', () => {
    render(<AiAnalysisSection imageId="img-1" />);
    fireEvent.click(screen.getByText('analyze'));
    expect(baseAnalysisStore.analyze).toHaveBeenCalledWith('img-1');
  });

  it('should show analyzing state', () => {
    mockAnalysis({ analyzingId: 'img-1' });
    render(<AiAnalysisSection imageId="img-1" />);
    expect(screen.getByText('analyzing')).toBeTruthy();
  });

  it('should show analysis description', () => {
    mockAnalysis({
      results: {
        'img-1': {
          description: 'A cat sitting on a couch',
          tags: [{ name: 'animal', confidence: 0.9 }],
          objects: ['cat'],
          colorPalette: ['#fff'],
          composition: 'center',
        },
      },
    });
    render(<AiAnalysisSection imageId="img-1" />);
    expect(screen.getByText(/A cat sitting/)).toBeTruthy();
  });

  it('should show tag suggestions', () => {
    mockAnalysis({
      results: {
        'img-1': {
          description: 'test',
          tags: [{ name: 'nature', confidence: 0.85 }, { name: 'landscape', confidence: 0.7 }],
          objects: [],
          colorPalette: [],
          composition: '',
        },
      },
    });
    render(<AiAnalysisSection imageId="img-1" />);
    expect(screen.getByText('nature')).toBeTruthy();
    expect(screen.getByText('landscape')).toBeTruthy();
  });

  it('should show objects joined with 、', () => {
    mockAnalysis({
      results: {
        'img-1': {
          description: 'test',
          tags: [],
          objects: ['cat', 'couch'],
          colorPalette: [],
          composition: '',
        },
      },
    });
    render(<AiAnalysisSection imageId="img-1" />);
    expect(screen.getByText('cat、couch')).toBeTruthy();
  });

  it('should not crash with no results', () => {
    render(<AiAnalysisSection imageId="img-1" />);
    expect(screen.getByText('analyze')).toBeTruthy();
  });
});
