'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/stores/theme-store';

export function ThemeInitializer() {
  const { colorTheme, visualStyle, enableAnimations } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
    document.documentElement.setAttribute('data-visual', visualStyle);
    document.documentElement.setAttribute('data-animations', String(enableAnimations));
  }, [colorTheme, visualStyle, enableAnimations]);

  return null;
}
