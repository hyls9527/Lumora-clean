import { create } from 'zustand';
import { invoke } from '../lib/tauri';

export type Language = 'zh' | 'en';
export type Theme = 'light' | 'dark';

interface SettingsState {
  language: Language;
  theme: Theme;
  _hydrated: boolean;
  // Actions
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'zh',
  theme: 'light',
  _hydrated: false,

  setLanguage: (language) => {
    set({ language });
    void invoke('set_setting', { key: 'language', value: language });
    document.documentElement.setAttribute('lang', language);
  },

  setTheme: (theme) => {
    // Only light is functional for now
    if (theme === 'dark') return;
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
      set({ language, theme, _hydrated: true });
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('data-theme', theme);
    } catch {
      set({ _hydrated: true });
    }
  },
}));
