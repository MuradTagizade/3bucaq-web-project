'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/store/themeStore';
import { useLanguageStore } from '@/lib/store/languageStore';

export default function ThemeProvider({ children }) {
  const initTheme = useThemeStore((s) => s.initTheme);
  const initLanguage = useLanguageStore((s) => s.initLanguage);

  useEffect(() => {
    initTheme();
    initLanguage();
  }, [initTheme, initLanguage]);

  return <>{children}</>;
}
