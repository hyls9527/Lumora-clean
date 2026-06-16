import { isTauri } from "@/lib/tauri";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = (window as any).__TAURI__;
  if (!tauri?.core?.invoke) {
    throw new Error("Tauri runtime not available");
  }
  return tauri.core.invoke(cmd, args);
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
