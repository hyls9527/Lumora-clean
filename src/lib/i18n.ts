import zh from '../i18n/zh.json';
import en from '../i18n/en.json';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

type NestedRecord = { [key: string]: string | NestedRecord };
type Language = 'zh' | 'en';

const resources: Record<Language, NestedRecord> = { zh, en };

// ---------------------------------------------------------------------------
// Independent language state source (no store dependency)
// ---------------------------------------------------------------------------

function getLanguage(): Language {
  try {
    const val = localStorage.getItem('lumora-lang');
    return val === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

// subscribe mechanism: listen to storage events (cross-tab) + manual notification
let listeners: Array<() => void> = [];
function subscribe(listener: () => void) {
  listeners.push(listener);
  const handler = (e: StorageEvent) => {
    if (e.key === 'lumora-lang') listener();
  };
  window.addEventListener('storage', handler);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener('storage', handler);
  };
}

/** Call after writing localStorage to notify same-tab subscribers. */
export function notifyLanguageChanged() {
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Translation utilities
// ---------------------------------------------------------------------------

function getNestedValue(obj: NestedRecord, path: string): string | undefined {
  const parts = path.split('.');
  let current: NestedRecord | string = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    const next: NestedRecord | string | undefined = current[part];
    if (next === undefined) return undefined;
    current = next;
  }
  return typeof current === 'string' ? current : undefined;
}

/** Standalone translation function (usable outside React components). */
export function t(
  key: string,
  lang?: Language,
  params?: Record<string, string | number>,
): string {
  const l = lang ?? getLanguage();
  const dict = resources[l] ?? resources.zh;
  let value = getNestedValue(dict, key) ?? key;
  if (params) {
    for (const [pk, pv] of Object.entries(params)) {
      value = value.replace(`{${pk}}`, String(pv));
    }
  }
  return value;
}

/** Simple translation hook — reads language from localStorage. */
export function useTranslation(namespace?: string) {
  const lang = useSyncExternalStore(subscribe, getLanguage);
  const dict = resources[lang] ?? resources.zh;
  const ns = namespace ?? '';

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const fullKey = ns ? `${ns}.${key}` : key;
      let value = getNestedValue(dict, fullKey) ?? fullKey;
      if (params) {
        for (const [pk, pv] of Object.entries(params)) {
          value = value.replace(`{${pk}}`, String(pv));
        }
      }
      return value;
    },
    [dict, ns],
  );

  return useMemo(() => ({ t: translate, lang }), [translate, lang]);
}
