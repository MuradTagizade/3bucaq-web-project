import { create } from 'zustand';

export const useThemeStore = create((set, get) => ({
  theme: 'dark',
  
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },
  
  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
    set({ theme: next });
  },
  
  initTheme: () => {
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem('theme');
      if (!saved) {
        saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', saved);
      set({ theme: saved });
    }
  }
}));
