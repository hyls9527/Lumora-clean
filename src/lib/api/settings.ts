import { invoke } from '../tauri';

/** Return the app version reported by the Rust backend. */
export async function getAppVersion(): Promise<string> {
  return invoke<string>('get_app_version');
}
