/**
 * 3bucaq — Theme Store (Zustand)
 */

import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  theme: 'dark',
  
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    set({ theme: 'dark' });
  },
  
  toggleTheme: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    set({ theme: 'dark' });
  },
  
  initTheme: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      set({ theme: 'dark' });
    }
  }
}));
