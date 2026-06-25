import { create } from 'zustand';

export interface Command {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  section: 'navigation' | 'action';
  action: () => void;
}

interface CommandState {
  isOpen: boolean;
  commands: Command[];
  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommands: (commands: Command[]) => void;
  unregisterCommands: (ids: string[]) => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  isOpen: false,
  commands: [],

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  registerCommands: (commands) =>
    set((s) => {
      const existingIds = new Set(s.commands.map((c) => c.id));
      const newCommands = commands.filter((c) => !existingIds.has(c.id));
      return { commands: [...s.commands, ...newCommands] };
    }),

  unregisterCommands: (ids) =>
    set((s) => ({
      commands: s.commands.filter((c) => !ids.includes(c.id)),
    })),
}));
