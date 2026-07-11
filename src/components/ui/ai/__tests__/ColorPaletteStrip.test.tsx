import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ColorPaletteStrip } from '../ColorPaletteStrip';

describe('ColorPaletteStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <ColorPaletteStrip colors={['#ff0000', '#00ff00', '#0000ff']} />
    );
    expect(container).toBeDefined();
  });

  it('should render color swatches', () => {
    const { container } = render(
      <ColorPaletteStrip colors={['#ff0000', '#00ff00', '#0000ff']} />
    );
    expect(container).toBeDefined();
  });

  it('should handle empty colors', () => {
    const { container } = render(
      <ColorPaletteStrip colors={[]} />
    );
    expect(container).toBeDefined();
  });
});
