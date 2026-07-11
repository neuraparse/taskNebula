import { create } from 'zustand';

interface NavigationReadyState {
  ready: boolean;
  readyVersion: number;
  markReady: () => void;
  reset: () => void;
}

export const useNavigationReady = create<NavigationReadyState>((set) => ({
  ready: false,
  readyVersion: 0,
  markReady: () => set((state) => ({ ready: true, readyVersion: state.readyVersion + 1 })),
  reset: () => set({ ready: false, readyVersion: 0 }),
}));
