import { create } from 'zustand';
import type { AuthDeepLink } from '@/lib/deep-links';

type AuthIntent = Exclude<AuthDeepLink, { kind: 'server' }>;

interface AuthIntentState {
  pending: AuthIntent | null;
  setPending: (intent: AuthIntent) => void;
  clear: () => void;
  consume: () => AuthIntent | null;
}

export const useAuthIntent = create<AuthIntentState>((set, get) => ({
  pending: null,
  setPending: (intent) => set({ pending: intent }),
  clear: () => set({ pending: null }),
  consume: () => {
    const current = get().pending;
    set({ pending: null });
    return current;
  },
}));
