/**
 * LEVEL UP — Language Store (Zustand)
 * Supported UI languages: English (default), Russian, Turkish, German, French.
 */

import { create } from 'zustand';
import { translations } from '../utils/translations';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'tr', label: 'Türkçe', short: 'TR' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'fr', label: 'Français', short: 'FR' },
];

export const DEFAULT_LANGUAGE = 'en';

const VALID_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

function normalize(lang) {
  return VALID_CODES.has(lang) ? lang : DEFAULT_LANGUAGE;
}

export const useLanguageStore = create((set) => ({
  language: DEFAULT_LANGUAGE,

  setLanguage: (lang) => {
    const next = normalize(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', next);
    }
    set({ language: next });
  },

  initLanguage: () => {
    if (typeof window !== 'undefined') {
      // Migrate any previously stored / removed language (e.g. 'az') to the default.
      const saved = normalize(localStorage.getItem('language'));
      if (localStorage.getItem('language') !== saved) {
        localStorage.setItem('language', saved);
      }
      set({ language: saved });
    }
  },
}));

// Resolve a dotted key path (e.g. "tx_type_labels.deposit") within a dictionary.
function lookup(dict, key) {
  if (!dict) return undefined;
  if (key.includes('.')) {
    let current = dict;
    for (const part of key.split('.')) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
  return dict[key];
}

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const t = (key, fallback) => {
    // 1) current language, 2) English base, 3) provided fallback, 4) the key itself.
    const active = lookup(translations[language], key);
    if (active !== undefined) return active;

    const base = lookup(translations[DEFAULT_LANGUAGE], key);
    if (base !== undefined) return base;

    return fallback !== undefined ? fallback : key;
  };

  return { t, language, setLanguage };
}
