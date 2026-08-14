import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../SettingsPage';
import { getAiProviderConfig, setAiProviderConfig, type AiProviderConfig } from '../../../lib/api/aiProvider';

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

// Mock AI provider API
vi.mock('../../../lib/api/aiProvider', () => ({
  // Default never resolves: unmocked tests must not schedule a state update
  // after teardown (same guard as the lan mock above).
  getAiProviderConfig: vi.fn(() => new Promise(() => {})),
  setAiProviderConfig: vi.fn(),
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

  const aiConfig: AiProviderConfig = {
    provider: 'ollama',
    visionProvider: 'ollama',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiApiKey: '',
    openaiEmbeddingModel: 'text-embedding-3-small',
    openaiVisionModel: 'gpt-4o-mini',
    ollamaEmbeddingModel: 'nomic-embed-text',
    ollamaVisionModel: 'llava:latest',
  };

  it('renders embedding and vision provider selectors', async () => {
    vi.mocked(getAiProviderConfig).mockResolvedValue(aiConfig);
    render(<SettingsPage />);
    expect(await screen.findByText('aiProviderLabel')).toBeDefined();
    expect(screen.getByText('aiVisionProviderLabel')).toBeDefined();
  });

  it('shows the OpenAI form when only the vision provider is OpenAI', async () => {
    vi.mocked(getAiProviderConfig).mockResolvedValue({ ...aiConfig, visionProvider: 'openai' });
    render(<SettingsPage />);
    expect(await screen.findByLabelText('aiBaseUrl')).toBeDefined();
    expect(screen.getByLabelText('aiApiKey')).toBeDefined();
  });

  it('persists an independent vision provider on save', async () => {
    const user = userEvent.setup();
    vi.mocked(getAiProviderConfig).mockResolvedValue(aiConfig);
    render(<SettingsPage />);
    await screen.findByText('aiProviderLabel');
    // Two "OpenAI-compatible" toggles exist: embedding first, vision second.
    const openaiToggles = screen.getAllByRole('button', { name: 'aiOpenAI' });
    await user.click(openaiToggles[1]);
    await user.click(screen.getByRole('button', { name: 'aiSave' }));
    expect(setAiProviderConfig).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'ollama', visionProvider: 'openai' }),
    );
  });
});
