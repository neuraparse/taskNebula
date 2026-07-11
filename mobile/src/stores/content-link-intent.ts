import { create } from 'zustand';
import type { ContentDeepLink } from '@/lib/deep-links';

interface ContentLinkIntentState {
  pending: ContentDeepLink | null;
  setPending: (intent: ContentDeepLink) => void;
  clear: () => void;
  consume: () => ContentDeepLink | null;
}

export const useContentLinkIntent = create<ContentLinkIntentState>((set, get) => ({
  pending: null,
  setPending: (intent) => set({ pending: intent }),
  clear: () => set({ pending: null }),
  consume: () => {
    const current = get().pending;
    set({ pending: null });
    return current;
  },
}));
