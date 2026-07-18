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
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'zh',
  theme: 'light',
  _hydrated: false,
  error: null,

  setLanguage: async (language) => {
    try {
      await invoke('set_setting', { key: 'language', value: language });
    } catch {
      set({ error: '语言设置保存失败' });
      return;
    }
    set({ language });
    localStorage.setItem('lumora-lang', language);
    document.documentElement.setAttribute('lang', language);
    notifyLanguageChanged();
  },

  setTheme: async (theme) => {
    try {
      await invoke('set_setting', { key: 'theme', value: theme });
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
        invoke<string | null>('get_setting', { key: 'language' }),
        invoke<string | null>('get_setting', { key: 'theme' }),
      ]);
      const language: Language = langRaw === 'en' ? 'en' : 'zh';
      const theme: Theme = themeRaw === 'dark' ? 'dark' : 'light';
      // Sync localStorage to match backend (single source of truth)
      localStorage.setItem('lumora-lang', language);
      set({ language, theme, _hydrated: true });
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('data-theme', theme);
      notifyLanguageChanged();
    } catch (err) {
      set({ _hydrated: true, error: err instanceof Error ? err.message : '设置加载失败' });
      
    }
  },
}));
