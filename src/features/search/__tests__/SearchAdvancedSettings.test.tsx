import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SearchAdvancedSettings } from '../SearchAdvancedSettings';

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

// Mock Collapsible
vi.mock('../../../components/ui/Collapsible', () => ({
  Collapsible: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="collapsible">
      <div>{title}</div>
      {children}
    </div>
  ),
}));

describe('SearchAdvancedSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <SearchAdvancedSettings searchHistory={[]} onSelectHistory={vi.fn()} />
    );
    expect(container).toBeDefined();
  });

  it('should render with search history', () => {
    const { container } = render(
      <SearchAdvancedSettings
        searchHistory={['nature', 'portrait']}
        onSelectHistory={vi.fn()}
      />
    );
    expect(container).toBeDefined();
  });
});
