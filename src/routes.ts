/**
 * Typed route definitions — single source of truth for all app routes.
 * Replaces the manual switch-case in App.tsx with a structured router.
 */

import type { ComponentType } from 'react';
import { lazy } from 'react';

// ── Route config ──────────────────────────────────
export interface RouteDef {
  path: string;
  /** i18n key for sidebar/command palette labels */
  i18nKey: string;
  /** i18n key for command palette description */
  cmdDescKey?: string;
  /** Keyboard shortcut (e.g. "⌘I") for command palette — optional */
  shortcut?: string;
  component: React.LazyExoticComponent<ComponentType<any>>;
  /** Dynamic import for the route chunk (used for background preloading). */
  load: () => Promise<unknown>;
}

export const ROUTES = {
  GALLERY: '/gallery',
  DASHBOARD: '/dashboard',
  IMPORT: '/import',
  SEARCH: '/search',
  TAGS: '/tags',
  EXPORT: '/export',
  FAVORITES: '/favorites',
  SETTINGS: '/settings',
  TRASH: '/trash',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const ALL_ROUTES: RoutePath[] = Object.values(ROUTES);

export const routeDefs: RouteDef[] = [
  {
    path: ROUTES.GALLERY,
    i18nKey: 'nav.creatorGallery',
    cmdDescKey: 'commandPalette.descGallery',
    component: lazy(() => import('./features/gallery/GalleryPage')),
    load: () => import('./features/gallery/GalleryPage'),
  },
  {
    path: ROUTES.DASHBOARD,
    i18nKey: 'nav.dashboard',
    cmdDescKey: 'commandPalette.descDashboard',
    component: lazy(() => import('./features/dashboard/DashboardPage')),
    load: () => import('./features/dashboard/DashboardPage'),
  },
  {
    path: ROUTES.IMPORT,
    i18nKey: 'nav.import',
    cmdDescKey: 'commandPalette.descImport',
    shortcut: '⌘I',
    component: lazy(() => import('./features/import/ImportPage')),
    load: () => import('./features/import/ImportPage'),
  },
  {
    path: ROUTES.SEARCH,
    i18nKey: 'nav.search',
    cmdDescKey: 'commandPalette.descSearch',
    component: lazy(() => import('./features/search/SearchPage')),
    load: () => import('./features/search/SearchPage'),
  },
  {
    path: ROUTES.TAGS,
    i18nKey: 'nav.tags',
    cmdDescKey: 'commandPalette.descTags',
    component: lazy(() => import('./features/tags/TagManager')),
    load: () => import('./features/tags/TagManager'),
  },
  {
    path: ROUTES.EXPORT,
    i18nKey: 'nav.export',
    cmdDescKey: 'commandPalette.descExport',
    component: lazy(() => import('./features/export/ExportPage')),
    load: () => import('./features/export/ExportPage'),
  },
  {
    path: ROUTES.FAVORITES,
    i18nKey: 'nav.favorites',
    component: lazy(() => import('./features/favorites/FavoritesPage')),
    load: () => import('./features/favorites/FavoritesPage'),
  },
  {
    path: ROUTES.SETTINGS,
    i18nKey: 'nav.settings',
    cmdDescKey: 'commandPalette.descSettings',
    component: lazy(() => import('./features/settings/SettingsPage')),
    load: () => import('./features/settings/SettingsPage'),
  },
  {
    path: ROUTES.TRASH,
    i18nKey: 'nav.trash',
    cmdDescKey: 'commandPalette.descTrash',
    component: lazy(() => import('./features/trash/TrashPage')),
    load: () => import('./features/trash/TrashPage'),
  },
];

/** Preload every lazy route chunk in the background for seamless navigation. */
export function preloadRoutes(): Promise<unknown>[] {
  return routeDefs.map((r) => r.load());
}

/** Lookup route def by path — O(1) via Map */
const routeMap = new Map<RoutePath, RouteDef>(routeDefs.map((r) => [r.path as RoutePath, r]));

export function getRouteDef(path: string): RouteDef | undefined {
  return routeMap.get(path as RoutePath);
}

/** Routes that appear in sidebar navigation (in display order) */
export const sidebarRoutes: RouteDef[] = [
  getRouteDef(ROUTES.GALLERY)!,
  getRouteDef(ROUTES.FAVORITES)!,
  getRouteDef(ROUTES.DASHBOARD)!,
  getRouteDef(ROUTES.IMPORT)!,
  getRouteDef(ROUTES.SEARCH)!,
  getRouteDef(ROUTES.TAGS)!,
  getRouteDef(ROUTES.EXPORT)!,
  getRouteDef(ROUTES.SETTINGS)!,
  getRouteDef(ROUTES.TRASH)!,
];

/** Routes that have keyboard shortcuts */
export const shortcutRoutes: RouteDef[] = routeDefs.filter((r) => r.shortcut);

export const DEFAULT_ROUTE: RoutePath = ROUTES.GALLERY;
