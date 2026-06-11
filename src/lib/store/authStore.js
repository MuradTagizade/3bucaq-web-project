/**
 * 3bucaq — Auth Store (Zustand)
 */

import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  userData: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  setUserData: (userData) => set({ userData }),
  setLoading: (loading) => set({ loading }),
  
  reset: () => set({ user: null, userData: null, loading: false }),
}));
