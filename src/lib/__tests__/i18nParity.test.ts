import { describe, it, expect } from 'vitest';
import en from '../../i18n/en.json';
import zh from '../../i18n/zh.json';

interface Nested {
  [key: string]: string | Nested;
}

function flattenKeys(obj: Nested, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'string' ? [key] : flattenKeys(v as Nested, key);
  });
}

describe('i18n parity (GA-18)', () => {
  it('zh and en expose identical key sets', () => {
    expect(flattenKeys(zh as Nested).sort()).toEqual(flattenKeys(en as Nested).sort());
  });

  it('contains the convert dialog keys added for GA-05', () => {
    const enKeys = flattenKeys(en as Nested);
    expect(enKeys).toContain('convert.filesCount');
    expect(enKeys).toContain('convert.error');
  });
});
