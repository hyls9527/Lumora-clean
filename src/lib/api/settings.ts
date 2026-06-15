import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";

export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri()) return localStorage.getItem(key);
  return invoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(key, value);
    return;
  }
  return invoke("set_setting", { key, value });
}
