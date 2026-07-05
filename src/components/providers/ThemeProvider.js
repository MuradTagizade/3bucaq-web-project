'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/store/themeStore';
import { useLanguageStore } from '@/lib/store/languageStore';

export default function ThemeProvider({ children }) {
  const initTheme = useThemeStore((s) => s.initTheme);
  const initLanguage = useLanguageStore((s) => s.initLanguage);
  const language = useLanguageStore((s) => s.language);

  useEffect(() => {
    initTheme();
    initLanguage();
  }, [initTheme, initLanguage]);

  // Dil dəyişdikcə <html lang> yenilənir ki, native kontrollar (məs. <input type="date">
  // təqvim pəncərəsi) bütün dillərdə seçilmiş dili izləsin, Türkcə qalmasın.
  useEffect(() => {
    if (typeof document !== 'undefined' && language) {
      document.documentElement.lang = language;
    }
  }, [language]);

  return <>{children}</>;
}
