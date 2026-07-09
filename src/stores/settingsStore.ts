import { create } from 'zustand';
import { invoke } from '../lib/tauri';
import { notifyLanguageChanged } from '../lib/i18n';

export type Language = 'zh' | 'en';
export type Theme = 'light' | 'dark';

interface SettingsState {
  language: Language;
  theme: Theme;
  _hydrated: boolean;
  error: string | null;
  // Actions
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'zh',
  theme: 'light',
  _hydrated: false,
  error: null,

  setLanguage: (language) => {
    set({ language });
    localStorage.setItem('lumora-lang', language);
    void invoke('set_setting', { key: 'language', value: language });
    document.documentElement.setAttribute('lang', language);
    notifyLanguageChanged();
  },

  setTheme: (theme) => {
    set({ theme });
    void invoke('set_setting', { key: 'theme', value: theme });
    document.documentElement.setAttribute('data-theme', theme);
  },

  hydrate: async () => {
    if (get()._hydrated) return;
    try {
      const [langRaw, themeRaw] = await Promise.all([
        invoke<string | null>('get_setting', { key: 'language' }),
        invoke<string | null>('get_setting', { key: 'theme' }),
      ]);
      const language: Language = langRaw === 'en' ? 'en' : 'zh';
      const theme: Theme = themeRaw === 'dark' ? 'dark' : 'light';
      localStorage.setItem('lumora-lang', language);
      set({ language, theme, _hydrated: true });
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('data-theme', theme);
    } catch (err) {
      set({ _hydrated: true, error: err instanceof Error ? err.message : '设置加载失败' });
    }
  },
}));
