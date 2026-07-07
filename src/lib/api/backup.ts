import { invoke } from '../tauri';

/** Export database to a file path. Returns the destination path. */
export async function exportDatabase(destination: string): Promise<string> {
  return invoke<string>('export_database', { destination });
}

/** Import database from a file path. Requires app restart. */
export async function importDatabase(source: string): Promise<string> {
  return invoke<string>('import_database', { source });
}
