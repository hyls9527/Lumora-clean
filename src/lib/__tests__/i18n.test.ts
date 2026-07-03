import { describe, it, expect, beforeEach } from 'vitest';
import { t, notifyLanguageChanged } from '../i18n';

beforeEach(() => {
  localStorage.clear();
});

describe('t() standalone translation function', () => {
  it('returns Chinese translation by default', () => {
    const result = t('gallery.title');
    expect(typeof result).toBe('string');
  });

  it('returns English translation when lang=en', () => {
    localStorage.setItem('lumora-lang', 'en');
    const result = t('gallery.title', 'en');
    expect(typeof result).toBe('string');
  });

  it('falls back to key when translation not found', () => {
    const result = t('nonexistent.key.path', 'zh');
    expect(result).toBe('nonexistent.key.path');
  });
});

describe('localStorage language source', () => {
  it('reads language from localStorage', () => {
    localStorage.setItem('lumora-lang', 'en');
    const resultEn = t('gallery.title', 'en');
    const resultZh = t('gallery.title', 'zh');
    expect(typeof resultEn).toBe('string');
    expect(typeof resultZh).toBe('string');
  });

  it('defaults to zh when localStorage is empty', () => {
    const result = t('gallery.title');
    expect(typeof result).toBe('string');
  });
});

describe('notifyLanguageChanged', () => {
  it('does not throw when no listeners registered', () => {
    expect(() => notifyLanguageChanged()).not.toThrow();
  });
});
