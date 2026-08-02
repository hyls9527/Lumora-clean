import { invoke } from '../tauri';

/** True when the given path exists and is a directory. */
export function isDirectory(path: string): Promise<boolean> {
  return invoke<boolean>('is_directory', { path });
}
