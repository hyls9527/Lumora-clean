import zh from '../i18n/zh.json';
import en from '../i18n/en.json';
import { useSettingsStore } from '../stores/settingsStore';
import type { Language } from '../stores/settingsStore';
import { useCallback, useMemo } from 'react';

type NestedRecord = { [key: string]: string | NestedRecord };

const resources: Record<Language, NestedRecord> = { zh, en };

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

/** Simple translation hook — reads language from settings store. */
export function useTranslation(namespace?: string) {
  const lang = useSettingsStore((s) => s.language);
  const dict = resources[lang] ?? resources.zh;
  const ns = namespace ?? '';

  const t = useCallback(
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

  return useMemo(() => ({ t, lang }), [t, lang]);
}
