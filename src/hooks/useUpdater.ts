/**
 * Auto-updater hook.
 * Thin React binding over the shared updateStore: the sidebar UpdateBanner
 * and the Settings page both render update progress, so the state must be
 * global — one check, one download, identical progress everywhere.
 */

import { useEffect } from 'react';
import { useUpdateStore, type UpdateState } from '../stores/updateStore';

export type UpdaterState = UpdateState;

export function useUpdater(): UpdaterState {
  const state = useUpdateStore();
  const { checkForUpdates } = state;

  // Check once per session on first mount; later mounts (opening Settings)
  // skip the automatic check — the manual check button still always works.
  useEffect(() => {
    if (!useUpdateStore.getState().hasChecked) {
      void checkForUpdates();
    }
  }, [checkForUpdates]);

  return state;
}
