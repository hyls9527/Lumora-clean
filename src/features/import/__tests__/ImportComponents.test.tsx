import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { StatCard, StatusBadge } from '../ImportComponents';

describe('ImportComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StatCard', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <StatCard dotColor="#ff0000" title="Test" status="Done" detail="100 items" />
      );
      expect(container).toBeDefined();
    });

    it('should display title', () => {
      const { container } = render(
        <StatCard dotColor="#ff0000" title="Imported" status="Complete" detail="50 files" />
      );
      expect(container.textContent).toContain('Imported');
    });

    it('should display status', () => {
      const { container } = render(
        <StatCard dotColor="#ff0000" title="Test" status="Processing" detail="..." />
      );
      expect(container.textContent).toContain('Processing');
    });
  });

  describe('StatusBadge', () => {
    it('should render done status', () => {
      const { container } = render(<StatusBadge status="done" />);
      expect(container).toBeDefined();
    });

    it('should render processing status', () => {
      const { container } = render(<StatusBadge status="processing" />);
      expect(container).toBeDefined();
    });
  });
});
