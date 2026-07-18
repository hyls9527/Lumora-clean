import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { LoadingSpinner } from '../LoadingSpinner';

afterEach(() => { cleanup(); });

describe('LoadingSpinner', () => {
  it('renders with default props (24px, currentColor)', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    const circle = container.querySelector('circle')!;
    expect(circle.getAttribute('stroke')).toBe('currentColor');
  });

  it('applies custom size', () => {
    const { container } = render(<LoadingSpinner size={48} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
  });

  it('applies custom color', () => {
    const { container } = render(<LoadingSpinner color="#ff0000" />);
    const circle = container.querySelector('circle')!;
    expect(circle.getAttribute('stroke')).toBe('#ff0000');
  });

  it('has spin animation on the SVG', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg')!;
    expect(svg.style.animation).toBe('spin 0.8s linear infinite');
  });

  it('has accessible role and label', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('status');
    expect(svg.getAttribute('aria-label')).toBe('Loading');
  });

  it('strokeWidth scales with size (floor at 2)', () => {
    const { container: c1 } = render(<LoadingSpinner size={12} />);
    expect(c1.querySelector('circle')!.getAttribute('stroke-width')).toBe('2');

    const { container: c2 } = render(<LoadingSpinner size={48} />);
    expect(c2.querySelector('circle')!.getAttribute('stroke-width')).toBe('4');
  });
});
