/**
 * 3bucaq — Theme Store (Zustand)
 */

import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  theme: 'dark', // default to dark
  
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },
  
  toggleTheme: () => {
    const current = useThemeStore.getState().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
    set({ theme: next });
  },
  
  initTheme: () => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      set({ theme: savedTheme });
    }
  }
}));
