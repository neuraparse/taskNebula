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

interface ThemeState {
  colorTheme: ColorTheme;
  visualStyle: VisualStyle;
  enableAnimations: boolean;
  enableGradients: boolean;
  setColorTheme: (theme: ColorTheme) => void;
  setVisualStyle: (style: VisualStyle) => void;
  setEnableAnimations: (enabled: boolean) => void;
  setEnableGradients: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorTheme: 'default',
      visualStyle: 'modern',
      enableAnimations: true,
      enableGradients: true,
      setColorTheme: (theme) => set({ colorTheme: theme }),
      setVisualStyle: (style) => set({ visualStyle: style }),
      setEnableAnimations: (enabled) => set({ enableAnimations: enabled }),
      setEnableGradients: (enabled) => set({ enableGradients: enabled }),
    }),
    {
      name: 'tasknebula-theme',
    }
  )
);

export const themeInfo: Record<ColorTheme, { name: string; description: string; preview: string[] }> = {
  default: {
    name: 'Blue',
    description: 'Professional blue accent',
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
