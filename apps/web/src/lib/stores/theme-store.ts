'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'purple'
  | 'rose';

export type VisualStyle = 'modern' | 'minimal' | 'glass';

export interface ServerAppearanceSettings {
  colorTheme?: ColorTheme | string | null;
  visualStyle?: VisualStyle | string | null;
  animationsEnabled?: boolean | null;
  gradientsEnabled?: boolean | null;
}

interface ThemeState {
  colorTheme: ColorTheme;
  visualStyle: VisualStyle;
  enableAnimations: boolean;
  enableGradients: boolean;
  hydrated: boolean;
  setColorTheme: (theme: ColorTheme) => void;
  setVisualStyle: (style: VisualStyle) => void;
  setEnableAnimations: (enabled: boolean) => void;
  setEnableGradients: (enabled: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  hydrateFromServer: (settings: ServerAppearanceSettings) => void;
  reset: () => void;
}

const VALID_COLOR_THEMES: ColorTheme[] = [
  'default',
  'ocean',
  'forest',
  'sunset',
  'purple',
  'rose',
];
const VALID_VISUAL_STYLES: VisualStyle[] = ['modern', 'minimal', 'glass'];

const defaultState = {
  colorTheme: 'default' as ColorTheme,
  visualStyle: 'modern' as VisualStyle,
  enableAnimations: true,
  enableGradients: true,
  hydrated: false,
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      ...defaultState,
      setColorTheme: (theme) => set({ colorTheme: theme }),
      setVisualStyle: (style) => set({ visualStyle: style }),
      setEnableAnimations: (enabled) => set({ enableAnimations: enabled }),
      setEnableGradients: (enabled) => set({ enableGradients: enabled }),
      setHydrated: (hydrated) => set({ hydrated }),
      hydrateFromServer: (settings) => {
        // Server wins on load, but only apply fields that are actually present
        // and valid — unknown/null fields leave the existing local value alone
        // so a partial server row doesn't wipe user choices.
        const patch: Partial<ThemeState> = {};
        if (
          typeof settings.colorTheme === 'string' &&
          (VALID_COLOR_THEMES as string[]).includes(settings.colorTheme)
        ) {
          patch.colorTheme = settings.colorTheme as ColorTheme;
        }
        if (
          typeof settings.visualStyle === 'string' &&
          (VALID_VISUAL_STYLES as string[]).includes(settings.visualStyle)
        ) {
          patch.visualStyle = settings.visualStyle as VisualStyle;
        }
        if (typeof settings.animationsEnabled === 'boolean') {
          patch.enableAnimations = settings.animationsEnabled;
        }
        if (typeof settings.gradientsEnabled === 'boolean') {
          patch.enableGradients = settings.gradientsEnabled;
        }
        set(patch);
      },
      reset: () => set({ ...defaultState, hydrated: true }),
    }),
    {
      name: 'tasknebula-theme',
      skipHydration: false,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);

export const themeInfo: Record<ColorTheme, { name: string; description: string; preview: string[] }> = {
  default: {
    name: 'Blue',
    description: 'Classic blue — default',
    preview: ['#3b82f6', '#60a5fa', '#93c5fd'],
  },
  ocean: {
    name: 'Teal',
    description: 'Fresh teal accent',
    preview: ['#0891b2', '#22d3ee', '#67e8f9'],
  },
  forest: {
    name: 'Green',
    description: 'Natural green accent',
    preview: ['#16a34a', '#22c55e', '#4ade80'],
  },
  sunset: {
    name: 'Orange',
    description: 'Warm orange accent',
    preview: ['#ea580c', '#f97316', '#fb923c'],
  },
  purple: {
    name: 'Purple',
    description: 'Rich purple accent',
    preview: ['#9333ea', '#a855f7', '#c084fc'],
  },
  rose: {
    name: 'Rose',
    description: 'Elegant rose accent',
    preview: ['#e11d48', '#f43f5e', '#fb7185'],
  },
};
