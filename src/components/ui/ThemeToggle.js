'use client';

import { useThemeStore } from '@/lib/store/themeStore';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ className = '', size = 20 }) {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by rendering a placeholder or loading state on server
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: size + 16, height: size + 16 }} />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`${styles.toggleBtn} ${className}`}
      aria-label={isDark ? 'Aydınlıq rejiminə keç' : 'Qaranlıq rejiminə keç'}
      title={isDark ? 'Aydınlıq rejimi' : 'Qaranlıq rejimi'}
    >
      {isDark ? (
        <Sun size={size} className={styles.iconSun} />
      ) : (
        <Moon size={size} className={styles.iconMoon} />
      )}
    </button>
  );
}
