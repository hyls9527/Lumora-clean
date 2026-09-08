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
      const registered = new Map(s.commands.map((c) => [c.id, c]));
      // Upsert: a re-registration with the same id (e.g. after a language
      // switch re-runs useRouteCommands) must replace the stale entry rather
      // than being dropped — otherwise the palette keeps old labels and old
      // closures (F-21).
      for (const cmd of commands) registered.set(cmd.id, cmd);
      return { commands: Array.from(registered.values()) };
    }),

  unregisterCommands: (ids) =>
    set((s) => ({
      commands: s.commands.filter((c) => !ids.includes(c.id)),
    })),
}));
