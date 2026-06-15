import { isTauri } from "@/lib/tauri";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri()) return localStorage.getItem(key);
  return tauriInvoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(key, value);
    return;
  }
  return tauriInvoke("set_setting", { key, value });
}
