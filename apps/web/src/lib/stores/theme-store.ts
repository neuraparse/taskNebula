'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'purple' | 'rose';

export type VisualStyle = 'modern' | 'minimal' | 'glass';
export type InterfaceFont = 'brand' | 'ibm';

export interface ServerAppearanceSettings {
  colorTheme?: ColorTheme | string | null;
  visualStyle?: VisualStyle | string | null;
  interfaceFont?: InterfaceFont | string | null;
  animationsEnabled?: boolean | null;
  gradientsEnabled?: boolean | null;
}

interface ThemeState {
  colorTheme: ColorTheme;
  visualStyle: VisualStyle;
  interfaceFont: InterfaceFont;
  enableAnimations: boolean;
  enableGradients: boolean;
  hydrated: boolean;
  setColorTheme: (theme: ColorTheme) => void;
  setVisualStyle: (style: VisualStyle) => void;
  setInterfaceFont: (font: InterfaceFont) => void;
  setEnableAnimations: (enabled: boolean) => void;
  setEnableGradients: (enabled: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  hydrateFromServer: (settings: ServerAppearanceSettings) => void;
  reset: () => void;
}

const VALID_COLOR_THEMES: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'purple', 'rose'];
const VALID_VISUAL_STYLES: VisualStyle[] = ['modern', 'minimal', 'glass'];
const VALID_INTERFACE_FONTS: InterfaceFont[] = ['brand', 'ibm'];

const INTERFACE_FONT_STACKS: Record<InterfaceFont, { sans: string; mono: string }> = {
  brand: {
    sans: "'Plus Jakarta Sans'",
    mono: "'JetBrains Mono'",
  },
  ibm: {
    sans: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
    mono: "'IBM Plex Mono', 'IBM Plex Sans', ui-monospace, monospace",
  },
};

function applyInterfaceFont(font: InterfaceFont) {
  if (typeof document === 'undefined') return;
  const stack = INTERFACE_FONT_STACKS[font] ?? INTERFACE_FONT_STACKS.brand;
  const root = document.documentElement;
  root.setAttribute('data-interface-font', font);
  root.style.setProperty('--app-font-sans', stack.sans);
  root.style.setProperty('--app-font-mono', stack.mono);
}

const defaultState = {
  colorTheme: 'default' as ColorTheme,
  visualStyle: 'modern' as VisualStyle,
  interfaceFont: 'ibm' as InterfaceFont,
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
      setInterfaceFont: (font) => {
        applyInterfaceFont(font);
        set({ interfaceFont: font });
      },
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
        if (
          typeof settings.interfaceFont === 'string' &&
          (VALID_INTERFACE_FONTS as string[]).includes(settings.interfaceFont)
        ) {
          patch.interfaceFont = settings.interfaceFont as InterfaceFont;
          applyInterfaceFont(patch.interfaceFont);
        }
        if (typeof settings.animationsEnabled === 'boolean') {
          patch.enableAnimations = settings.animationsEnabled;
        }
        if (typeof settings.gradientsEnabled === 'boolean') {
          patch.enableGradients = settings.gradientsEnabled;
        }
        set(patch);
      },
      reset: () => {
        applyInterfaceFont(defaultState.interfaceFont);
        set({ ...defaultState, hydrated: true });
      },
    }),
    {
      name: 'tasknebula-theme',
      skipHydration: false,
      onRehydrateStorage: () => (state) => {
        if (state) {
          const font = VALID_INTERFACE_FONTS.includes(state.interfaceFont)
            ? state.interfaceFont
            : defaultState.interfaceFont;
          applyInterfaceFont(font);
          if (font !== state.interfaceFont) {
            state.setInterfaceFont(font);
          }
          state.setHydrated(true);
        }
      },
    }
  )
);

export const themeInfo: Record<ColorTheme, { preview: string[] }> = {
  default: {
    preview: ['#3b82f6', '#60a5fa', '#93c5fd'],
  },
  ocean: {
    preview: ['#0891b2', '#22d3ee', '#67e8f9'],
  },
  forest: {
    preview: ['#16a34a', '#22c55e', '#4ade80'],
  },
  sunset: {
    preview: ['#ea580c', '#f97316', '#fb923c'],
  },
  purple: {
    preview: ['#9333ea', '#a855f7', '#c084fc'],
  },
  rose: {
    preview: ['#e11d48', '#f43f5e', '#fb7185'],
  },
};
