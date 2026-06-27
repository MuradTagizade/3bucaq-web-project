import { create } from 'zustand';

export const useThemeStore = create((set, get) => ({
  theme: 'dark',
  
  setTheme: (theme) => {
    // Light mode disabled — always force dark
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    set({ theme: 'dark' });
  },
  
  toggleTheme: () => {
    // Light mode disabled — no-op
  },
  
  initTheme: () => {
    // Light mode disabled — always init as dark
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      set({ theme: 'dark' });
    }
  }
}));
