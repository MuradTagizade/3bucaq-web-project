'use client';

import { useThemeStore } from '@/lib/store/themeStore';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme, initTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initTheme();
    setMounted(true);
  }, [initTheme]);

  if (!mounted) {
    return (
      <button className={styles.toggleBtn} aria-label="Theme Toggle Placeholder">
        <Sun size={18} className={styles.iconSun} />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={styles.toggleBtn}
      aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === 'dark' ? (
        <Sun size={18} className={styles.iconSun} />
      ) : (
        <Moon size={18} className={styles.iconMoon} />
      )}
    </button>
  );
}
