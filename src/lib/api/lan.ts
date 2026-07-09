import { invoke } from '../tauri';

export async function getLanInfo(): Promise<{ ip: string; port: number }> {
  const [ip, port] = await invoke<[string, number]>('get_lan_info');
  return { ip, port };
}
