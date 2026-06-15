import { create } from "zustand";
import { getSetting, setSetting } from "@/lib/api/settings";

interface SettingsState {
  language: "en" | "zh";
  theme: "light" | "dark";
  gridColumns: number;
  loadSettings: () => Promise<void>;
  setLanguage: (lang: "en" | "zh") => void;
  setTheme: (theme: "light" | "dark") => void;
  setGridColumns: (cols: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: "zh",
  theme: "light",
  gridColumns: 4,

  loadSettings: async () => {
    const lang = await getSetting("language");
    const theme = await getSetting("theme");
    const cols = await getSetting("gridColumns");

    set({
      language: (lang as "en" | "zh") || "zh",
      theme: (theme as "light" | "dark") || "light",
      gridColumns: cols ? parseInt(cols) : 4,
    });
  },

  setLanguage: (lang) => {
    set({ language: lang });
    setSetting("language", lang);
  },

  setTheme: (theme) => {
    set({ theme: theme });
    setSetting("theme", theme);
  },

  setGridColumns: (cols) => {
    set({ gridColumns: cols });
    setSetting("gridColumns", String(cols));
  },
}));
