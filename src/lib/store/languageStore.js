/**
 * Level Up — Language Store (Zustand)
 */

import { create } from 'zustand';
import { translations } from '../utils/translations';

export const useLanguageStore = create((set) => ({
  language: 'az', // default to Azerbaijani
  
  setLanguage: (lang) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
    set({ language: lang });
  },
  
  initLanguage: () => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language') || 'az';
      set({ language: savedLang });
    }
  }
}));

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const t = (key, fallback) => {
    const dict = translations[language] || translations.az;
    if (dict) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = dict;
        for (const part of parts) {
          if (current === undefined || current === null) {
            current = undefined;
            break;
          }
          current = current[part];
        }
        if (current !== undefined) {
          return current;
        }
      } else if (dict[key] !== undefined) {
        return dict[key];
      }
    }
    return fallback !== undefined ? fallback : key;
  };

  return { t, language, setLanguage };
}
