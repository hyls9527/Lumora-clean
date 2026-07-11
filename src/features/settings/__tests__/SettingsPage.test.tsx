import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';

// Mock the store
vi.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      language: 'zh',
      theme: 'dark',
      ollamaHost: 'http://localhost:11434',
      setLanguage: vi.fn(),
      setTheme: vi.fn(),
      setOllamaHost: vi.fn(),
      hydrate: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock API
vi.mock('../../../lib/api/backup', () => ({
  exportDatabase: vi.fn(),
  importDatabase: vi.fn(),
}));

vi.mock('../../../lib/api/lan', () => ({
  getLanInfo: vi.fn().mockResolvedValue({ port: 8079, ip: '192.168.1.100' }),
}));

// Mock Tauri dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock i18n
vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  t: (k: string) => k,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<SettingsPage />);
    expect(container).toBeDefined();
  });

  it('should render settings sections', () => {
    const { container } = render(<SettingsPage />);
    const headings = container.querySelectorAll('h2');
    expect(headings.length).toBeGreaterThan(0);
  });
});
