import { create, type StateCreator } from 'zustand';
import { invoke as realInvoke } from '../lib/tauri';
import { notifyLanguageChanged } from '../lib/i18n';

export type Language = 'zh' | 'en';
export type Theme = 'light' | 'dark';

/** External dependencies consumed by settingsStore. */
export interface SettingsStoreDeps {
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  /** Called after language changes to notify i18n system. */
  notifyLanguageChanged: () => void;
  /** Store for persisting language preference. */
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
}

const defaultDeps: SettingsStoreDeps = {
  invoke: realInvoke,
  notifyLanguageChanged,
  storage: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
};

interface SettingsState {
  language: Language;
  theme: Theme;
  _hydrated: boolean;
  error: string | null;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  hydrate: () => Promise<void>;
}

export function createSettingsStore(deps: SettingsStoreDeps = defaultDeps): StateCreator<SettingsState, [], []> {
  return (set, get) => ({
    language: 'zh',
    theme: 'light',
    _hydrated: false,
    error: null,

    setLanguage: async (language) => {
      try {
        await deps.invoke('set_setting', { key: 'language', value: language });
      } catch {
        set({ error: '语言设置保存失败' });
        return;
      }
      set({ language });
      deps.storage.setItem('lumora-lang', language);
      document.documentElement.setAttribute('lang', language);
      deps.notifyLanguageChanged();
    },

    setTheme: async (theme) => {
      try {
        await deps.invoke('set_setting', { key: 'theme', value: theme });
      } catch {
        set({ error: '主题设置保存失败' });
        return;
      }
      set({ theme });
      document.documentElement.setAttribute('data-theme', theme);
    },

    hydrate: async () => {
      if (get()._hydrated) return;
      try {
        const [langRaw, themeRaw] = await Promise.all([
          deps.invoke<string | null>('get_setting', { key: 'language' }),
          deps.invoke<string | null>('get_setting', { key: 'theme' }),
        ]);
        const language: Language = langRaw === 'en' ? 'en' : 'zh';
        const theme: Theme = themeRaw === 'dark' ? 'dark' : 'light';
        deps.storage.setItem('lumora-lang', language);
        set({ language, theme, _hydrated: true });
        document.documentElement.setAttribute('lang', language);
        document.documentElement.setAttribute('data-theme', theme);
        deps.notifyLanguageChanged();
      } catch (err) {
        set({ _hydrated: true, error: err instanceof Error ? err.message : '设置加载失败' });
      }
    },
  });
}

export const useSettingsStore = create<SettingsState>()(createSettingsStore(defaultDeps));
