import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCommandStore } from '../stores/commandStore';
import { useTranslation } from '../lib/i18n';
import { routeDefs, DEFAULT_ROUTE, type RoutePath, type RouteDef } from '../routes';
import type { Command } from '../stores/commandStore';

interface UseRouterReturn {
  route: RoutePath;
  routeDef: RouteDef | undefined;
  navigate: (path: RoutePath) => void;
}

/** Typed router — replaces manual useState switch-case */
export function useRouter(): UseRouterReturn {
  const [route, setRoute] = useState<RoutePath>(DEFAULT_ROUTE);
  const navigate = useCallback((path: RoutePath) => setRoute(path), []);

  const routeDef = useMemo(() => {
    return routeDefs.find((r) => r.path === route);
  }, [route]);

  return { route, routeDef, navigate };
}

/** Registers route commands in the command palette. Call once in App. */
export function useRouteCommands(
  navigate: (path: RoutePath) => void,
): void {
  const { registerCommands } = useCommandStore();
  const { t } = useTranslation();

  useEffect(() => {
    const commands: Command[] = routeDefs
      .filter((r) => r.cmdDescKey)
      .map((r) => ({
        id: `nav-${r.path.slice(1)}`,
        name: t(r.i18nKey),
        description: t(r.cmdDescKey!),
        section: 'navigation' as const,
        shortcut: r.shortcut,
        action: () => navigate(r.path as RoutePath),
      }));

    // Add action commands
    commands.push(
      {
        id: 'action-import',
        name: t('commandPalette.importImages'),
        description: t('commandPalette.importImagesDesc'),
        shortcut: '⌘I',
        section: 'action',
        action: () => navigate('/import' as RoutePath),
      },
      {
        id: 'action-refresh',
        name: t('commandPalette.refreshGallery'),
        description: t('commandPalette.refreshGalleryDesc'),
        shortcut: '⌘R',
        section: 'action',
        action: () => navigate('/gallery' as RoutePath),
      },
      {
        id: 'action-empty-trash',
        name: t('commandPalette.emptyTrash'),
        description: t('commandPalette.emptyTrashDesc'),
        section: 'action',
        action: () => navigate('/trash' as RoutePath),
      },
    );

    registerCommands(commands);
  }, [registerCommands, t, navigate]);
}

/** Registers global keyboard shortcuts (⌘K, ⌘I, ⌘R) */
export function useGlobalShortcuts(
  navigate: (path: RoutePath) => void,
): void {
  const { toggle } = useCommandStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        toggle();
        return;
      }
      if (mod && e.key === 'i') {
        e.preventDefault();
        navigate('/import' as RoutePath);
        return;
      }
      if (mod && e.key === 'r') {
        e.preventDefault();
        navigate('/gallery' as RoutePath);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, navigate]);
}
