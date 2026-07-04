import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DetailModal } from '../DetailModal';

// Mock the tauri lib (convertFileSrc)
vi.mock('../../../lib/tauri', () => ({
  convertFileSrc: vi.fn((path: string) => Promise.resolve(`asset://localhost/${encodeURIComponent(path)}`)),
}));

const MOCK_IMAGE = {
  id: 'img-1',
  filePath: '/test/image.png',
  fileName: 'image.png',
  fileSizeKb: 1024,
  width: 800,
  height: 600,
  format: 'png' as const,
  createdAt: '2025-01-15T10:30:00Z',
  rating: 4,
  favorite: true,
  model: 'stable-diffusion',
  prompt: 'A beautiful mountain landscape',
  tags: ['nature', 'landscape', 'mountain'],
};

afterEach(() => {
  cleanup();
});

describe('DetailModal', () => {
  it('renders nothing when image is null', () => {
    const { container } = render(<DetailModal image={null} onClose={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders image dimensions', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    const dimensions = screen.getAllByText(/800.*600/);
    expect(dimensions.length).toBeGreaterThan(0);
  });

  it('renders file size', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    expect(screen.getByText('1.0 MB')).toBeDefined();
  });

  it('renders model name', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    expect(screen.getByText('stable-diffusion')).toBeDefined();
  });

  it('renders tags', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    expect(screen.getByText('nature')).toBeDefined();
    expect(screen.getByText('landscape')).toBeDefined();
    expect(screen.getByText('mountain')).toBeDefined();
  });

  it('renders favorite indicator', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    expect(screen.getByText('◆')).toBeDefined();
  });

  it('renders rating component', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    const ratingButtons = screen.getAllByLabelText(/梅花印/);
    expect(ratingButtons.length).toBe(5);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<DetailModal image={MOCK_IMAGE} onClose={onClose} />);

    const closeButton = screen.getByLabelText('关闭');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('has dialog role for accessibility', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('has correct panel border radius', () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    const panel = dialog.querySelector('[style*="border-radius"]') as HTMLElement;
    expect(panel?.style.borderRadius).toBe('6px');
  });

  it('renders an img element with asset protocol src', async () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    const img = await screen.findByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toContain('asset://localhost');
    expect(img.getAttribute('src')).toContain(encodeURIComponent('/test/image.png'));
  });

  it('renders img with alt text from fileName', async () => {
    render(<DetailModal image={MOCK_IMAGE} onClose={vi.fn()} />);

    const img = await screen.findByRole('img');
    expect(img.getAttribute('alt')).toBe('image.png');
  });
});
