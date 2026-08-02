import { invoke } from '../tauri';

export interface LanInfo {
  ip: string;
  port: number;
  token: string;
}

export async function getLanInfo(): Promise<LanInfo> {
  const [ip, port, token] = await invoke<[string, number, string]>('get_lan_info');
  return { ip, port, token };
}
