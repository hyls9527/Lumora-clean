import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VariantGroup } from '../VariantGroup';
import { useVariantStore } from '../../../stores/variantStore';
import type { ImageRecord } from '../../../types/image';

vi.mock('../../../hooks/useImageSrc', () => ({
  useImageSrc: (p: string | null) => p ?? '',
}));

const IMG = (id: string): ImageRecord => ({
  id, filePath: `/img/${id}.png`, fileName: `${id}.png`,
  fileSizeKb: 100, width: 512, height: 512, format: 'png',
  createdAt: '2024-01-01', rating: 0, favorite: false,
  model: 'sdxl', prompt: 'a cat', tags: [], variantGroupId: 'g1',
});

beforeEach(() => {
  useVariantStore.setState({
    variants: [],
    loading: false,
    error: null,
    currentGroupId: null,
  });
});

afterEach(() => cleanup());

describe('VariantGroup', () => {
  it('renders nothing when no groupId', () => {
    const { container } = render(
      <VariantGroup groupId={null} currentImageId="v1" onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('fetches variants on mount', () => {
    const spy = vi.spyOn(useVariantStore.getState(), 'fetchVariants');
    render(<VariantGroup groupId="g1" currentImageId="v1" onSelect={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith('g1');
    spy.mockRestore();
  });

  it('clears on unmount', () => {
    const spy = vi.spyOn(useVariantStore.getState(), 'clearVariants');
    const { unmount } = render(
      <VariantGroup groupId="g1" currentImageId="v1" onSelect={vi.fn()} />,
    );
    unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows loading', () => {
    useVariantStore.setState({ loading: true });
    render(<VariantGroup groupId="g1" currentImageId="v1" onSelect={vi.fn()} />);
    expect(screen.getAllByText(/加载中|Loading/).length).toBeGreaterThan(0);
  });

  it('shows error', () => {
    useVariantStore.setState({ error: 'fail', currentGroupId: 'g1' });
    render(<VariantGroup groupId="g1" currentImageId="v1" onSelect={vi.fn()} />);
    expect(screen.getAllByText('fail').length).toBeGreaterThan(0);
  });

  it('shows variants excluding current', () => {
    useVariantStore.setState({
      variants: [IMG('v1'), IMG('v2'), IMG('v3')],
      currentGroupId: 'g1',
    });
    render(<VariantGroup groupId="g1" currentImageId="v1" onSelect={vi.fn()} />);
    expect(screen.getAllByText(/变体|Variants/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('#1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('#2').length).toBeGreaterThan(0);
  });

  it('calls onSelect', () => {
    const fn = vi.fn();
    useVariantStore.setState({
      variants: [IMG('v1'), IMG('v2')],
      currentGroupId: 'g1',
    });
    render(<VariantGroup groupId="g1" currentImageId="v1" onSelect={fn} />);
    screen.getAllByText('#1')[0].closest('button')?.click();
    expect(fn).toHaveBeenCalledWith(IMG('v2'));
  });

  it('hides when only 1 variant', () => {
    useVariantStore.setState({
      variants: [IMG('v1')],
      currentGroupId: 'g1',
    });
    const { container } = render(
      <VariantGroup groupId="g1" currentImageId="v1" onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
