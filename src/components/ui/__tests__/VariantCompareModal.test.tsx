import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VariantCompareModal } from '../VariantCompareModal';
import { useImageSrc } from '../../../hooks/useImageSrc';
import type { ImageRecord } from '../../../types/image';

vi.mock('../../../hooks/useImageSrc', () => ({
  useImageSrc: vi.fn(() => 'mock-src'),
}));

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

afterEach(() => { cleanup(); });

const makeImage = (id: string, fileName: string): ImageRecord => ({
  id,
  filePath: `/photos/${fileName}`,
  fileName,
  fileSizeKb: 100,
  width: 512,
  height: 512,
  format: 'png',
  createdAt: '2025-01-01',
  rating: 0,
  favorite: false,
  model: 'sd1.5',
  prompt: 'a cat',
  tags: [],
});

describe('VariantCompareModal', () => {
  const images = [
    makeImage('a', 'a.png'),
    makeImage('b', 'b.png'),
    makeImage('c', 'c.png'),
  ];
  const onClose = vi.fn();
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <VariantCompareModal open={false} images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders all images when open', () => {
    const { container } = render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(3);
  });

  it('highlights the active image', () => {
    const { container } = render(
      <VariantCompareModal open images={images} activeId="b" onClose={onClose} onSelect={onSelect} />,
    );
    const cards = container.querySelectorAll('[data-variant-card]');
    expect(cards.length).toBe(3);
    // Active card should have cursor default (not pointer)
    expect((cards[1] as HTMLElement).style.cursor).toBe('default');
    // Non-active cards should have cursor pointer
    expect((cards[0] as HTMLElement).style.cursor).toBe('pointer');
  });

  it('calls onSelect when clicking a non-active image', () => {
    const { container } = render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    const cards = container.querySelectorAll('[data-variant-card]');
    fireEvent.click(cards[1]); // click 'b'
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('does not call onSelect when clicking the active image', () => {
    const { container } = render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    const cards = container.querySelectorAll('[data-variant-card]');
    fireEvent.click(cards[0]); // click 'a' (active)
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking the overlay background', () => {
    const { container } = render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows image index labels', () => {
    const { container } = render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    expect(container.textContent).toContain('#1');
    expect(container.textContent).toContain('#2');
    expect(container.textContent).toContain('#3');
  });

  it('shows a dimension placeholder when the image source fails to load', () => {
    vi.mocked(useImageSrc).mockReturnValue(null);
    const { container } = render(
      <VariantCompareModal open images={images} activeId="a" onClose={onClose} onSelect={onSelect} />,
    );
    expect(container.textContent).toContain('512 × 512');
    expect(container.querySelectorAll('img').length).toBe(0);
  });
});
