import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock document for Node environment (vitest default)
const docAttrs: Record<string, string> = {};
const mockSetAttribute = vi.fn((key: string, value: string) => { docAttrs[key] = value; });
const mockGetAttribute = vi.fn((key: string) => docAttrs[key] ?? null);
vi.stubGlobal('document', {
  documentElement: { setAttribute: mockSetAttribute, getAttribute: mockGetAttribute },
});

// Mock tauri — must match the import path used by settingsStore
vi.mock('../../lib/tauri', () => ({
  invoke: vi.fn(),
  isTauriAvailable: false,
}));

// Mock i18n — settingsStore imports notifyLanguageChanged from it
vi.mock('../../lib/i18n', () => ({
  notifyLanguageChanged: vi.fn(),
}));

import { useSettingsStore } from '../settingsStore';
import * as tauri from '../../lib/tauri';

const mockInvoke = vi.mocked(tauri.invoke);

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(docAttrs).forEach(k => delete docAttrs[k]);
  useSettingsStore.setState({
    language: 'zh',
    theme: 'light',
    _hydrated: false,
    error: null,
  });
});

describe('setLanguage', () => {
  it('sets language state', () => {
    useSettingsStore.getState().setLanguage('en');
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('invokes set_setting with language key', () => {
    useSettingsStore.getState().setLanguage('en');
    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'language',
      value: 'en',
    });
  });

  it('sets document.documentElement lang attribute', () => {
    useSettingsStore.getState().setLanguage('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('writes language to localStorage', () => {
    useSettingsStore.getState().setLanguage('en');
    expect(localStorage.getItem('lumora-lang')).toBe('en');
  });
});

describe('setTheme', () => {
  it('sets theme state for light', () => {
    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('invokes set_setting with theme key', () => {
    useSettingsStore.getState().setTheme('light');
    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'theme',
      value: 'light',
    });
  });

  it('sets data-theme attribute', () => {
    useSettingsStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('rejects dark theme — returns early without changing state', () => {
    mockInvoke.mockClear();
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('dark');
  });
});

describe('hydrate', () => {
  it('loads language and theme from invoke', async () => {
    mockInvoke.mockImplementation((_cmd: string, args?: Record<string, unknown>) => {
      if ((args as Record<string, unknown>)?.key === 'language') return Promise.resolve('en');
      if ((args as Record<string, unknown>)?.key === 'theme') return Promise.resolve('light');
      return Promise.resolve(null);
    });

    await useSettingsStore.getState().hydrate();

    expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'language' });
    expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'theme' });
    expect(useSettingsStore.getState().language).toBe('en');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('sets _hydrated to true', async () => {
    mockInvoke.mockResolvedValue(null);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState()._hydrated).toBe(true);
  });

  it('sets document attributes after hydrate', async () => {
    mockInvoke.mockImplementation((_cmd: string, args?: Record<string, unknown>) => {
      if ((args as Record<string, unknown>)?.key === 'language') return Promise.resolve('en');
      if ((args as Record<string, unknown>)?.key === 'theme') return Promise.resolve('light');
      return Promise.resolve(null);
    });
    await useSettingsStore.getState().hydrate();
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to zh/light when invoke returns null', async () => {
    mockInvoke.mockResolvedValue(null);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().language).toBe('zh');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('writes language to localStorage after hydrate', async () => {
    mockInvoke.mockImplementation((_cmd: string, args?: Record<string, unknown>) => {
      if ((args as Record<string, unknown>)?.key === 'language') return Promise.resolve('en');
      return Promise.resolve(null);
    });
    await useSettingsStore.getState().hydrate();
    expect(localStorage.getItem('lumora-lang')).toBe('en');
  });

  it('skips hydration if already hydrated', async () => {
    useSettingsStore.setState({ _hydrated: true });
    await useSettingsStore.getState().hydrate();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('sets _hydrated on invoke error', async () => {
    mockInvoke.mockRejectedValue(new Error('backend unavailable'));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState()._hydrated).toBe(true);
  });

  it('sets error on invoke failure', async () => {
    mockInvoke.mockRejectedValue(new Error('hydrate failed'));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().error).toBe('hydrate failed');
    expect(useSettingsStore.getState()._hydrated).toBe(true);
  });
});
