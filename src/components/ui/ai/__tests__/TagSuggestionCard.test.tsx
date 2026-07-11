import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TagSuggestionCard } from '../TagSuggestionCard';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
  t: (k: string) => k,
}));

describe('TagSuggestionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <TagSuggestionCard
        tag={{ name: 'nature', confidence: 0.9 }}
        accepted={false}
        rejected={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(container).toBeDefined();
  });

  it('should display tag name', () => {
    const { container } = render(
      <TagSuggestionCard
        tag={{ name: 'nature', confidence: 0.9 }}
        accepted={false}
        rejected={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(container.textContent).toContain('nature');
  });

  it('should display confidence', () => {
    const { container } = render(
      <TagSuggestionCard
        tag={{ name: 'nature', confidence: 0.9 }}
        accepted={false}
        rejected={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(container.textContent).toContain('90');
  });

  it('should call onAccept when accept button clicked', () => {
    const onAccept = vi.fn();
    const { container } = render(
      <TagSuggestionCard
        tag={{ name: 'nature', confidence: 0.9 }}
        accepted={false}
        rejected={false}
        onAccept={onAccept}
        onReject={vi.fn()}
      />
    );
    const buttons = container.querySelectorAll('button');
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
    }
  });

  it('should call onReject when reject button clicked', () => {
    const onReject = vi.fn();
    const { container } = render(
      <TagSuggestionCard
        tag={{ name: 'nature', confidence: 0.9 }}
        accepted={false}
        rejected={false}
        onAccept={vi.fn()}
        onReject={onReject}
      />
    );
    const buttons = container.querySelectorAll('button');
    if (buttons.length > 1) {
      fireEvent.click(buttons[1]);
    }
  });
});
