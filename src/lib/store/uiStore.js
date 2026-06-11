/**
 * 3bucaq — UI Store (Zustand)
 */

import { create } from 'zustand';

export const useUIStore = create((set) => ({
  menuOpen: false,
  activeModal: null,
  modalData: null,

  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),

  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
}));
