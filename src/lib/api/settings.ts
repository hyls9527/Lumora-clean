import { invoke } from '../tauri';

/** Return the app version reported by the Rust backend. */
export async function getAppVersion(): Promise<string> {
  return invoke<string>('get_app_version');
}

/** Read a settings.json value (null when unset). */
export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key });
}

/** Persist a settings.json value. */
export async function setSetting(key: string, value: string): Promise<void> {
  await invoke('set_setting', { key, value });
}
