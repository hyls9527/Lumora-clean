// Mock API — settings stored in localStorage
export async function getSetting(key: string): Promise<string | null> {
  return localStorage.getItem(key)
}

export async function setSetting(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value)
}
