'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useThemeStore } from '@/lib/stores/theme-store';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeInitializer() {
  const colorTheme = useThemeStore((s) => s.colorTheme);
  const visualStyle = useThemeStore((s) => s.visualStyle);
  const enableAnimations = useThemeStore((s) => s.enableAnimations);
  const enableGradients = useThemeStore((s) => s.enableGradients);

  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', colorTheme);
    root.setAttribute('data-visual', visualStyle);
    root.setAttribute('data-animations', String(enableAnimations));
    root.setAttribute('data-gradients', String(enableGradients));
  }, [colorTheme, visualStyle, enableAnimations, enableGradients]);

  return null;
}
