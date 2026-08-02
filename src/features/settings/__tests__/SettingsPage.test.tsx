import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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
  // Never-resolving promise: the mount fetch must not schedule a state update
  // after the test environment is torn down (react-dom teardown flake).
  getLanInfo: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  // Same teardown-race guard: useUpdater's mount-time check() must never
  // resolve/reject after the jsdom environment is torn down.
  check: vi.fn(() => new Promise<null>(() => {})),
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

  afterEach(() => {
    cleanup();
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

  it('renders the app version from the backend', async () => {
    const { findByText } = render(<SettingsPage />);
    expect(await findByText('version: 0.8.0')).toBeDefined();
  });
});
