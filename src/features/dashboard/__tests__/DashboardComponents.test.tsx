import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DotRow, SectionTitle, formatTime } from '../DashboardComponents';

describe('DashboardComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DotRow', () => {
    it('should render without crashing', () => {
      const { container } = render(<DotRow label="Test" value="Value" />);
      expect(container).toBeDefined();
    });

    it('should display label and value', () => {
      const { container } = render(<DotRow label="Images" value={100} />);
      expect(container.textContent).toContain('Images');
      expect(container.textContent).toContain('100');
    });

    it('should render with indent', () => {
      const { container } = render(<DotRow label="Test" value="Value" indent={2} />);
      expect(container).toBeDefined();
    });
  });

  describe('SectionTitle', () => {
    it('should render without crashing', () => {
      const { container } = render(<SectionTitle>Test Title</SectionTitle>);
      expect(container).toBeDefined();
    });

    it('should display children', () => {
      const { container } = render(<SectionTitle>Statistics</SectionTitle>);
      expect(container.textContent).toContain('Statistics');
    });
  });

  describe('formatTime', () => {
    it('should format ISO date string', () => {
      const result = formatTime('2025-01-15T10:30:00Z');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return a string for any input', () => {
      const result = formatTime('invalid');
      expect(typeof result).toBe('string');
    });
  });
});
