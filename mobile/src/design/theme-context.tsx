import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  createMobileTheme,
  defaultMobileTheme,
  type AppearanceThemeInput,
  type MobileRuntimeTheme,
  type ThemeColors,
  type ThemeEffects,
  type ThemeTypography,
} from '@/design/theme';

const MobileThemeContext = createContext<MobileRuntimeTheme>(defaultMobileTheme);

export function MobileThemeProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings?: AppearanceThemeInput;
}) {
  const systemScheme = useColorScheme();
  const normalizedSystemScheme =
    systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : undefined;
  const theme = useMemo(
    () => createMobileTheme(settings, normalizedSystemScheme),
    [settings, normalizedSystemScheme],
  );

  return <MobileThemeContext.Provider value={theme}>{children}</MobileThemeContext.Provider>;
}

export function useMobileTheme(): MobileRuntimeTheme {
  return useContext(MobileThemeContext);
}

export function useThemeColors(): ThemeColors {
  return useMobileTheme().colors;
}

export function useThemeTypography(): ThemeTypography {
  return useMobileTheme().typography;
}

export function useThemeEffects(): ThemeEffects {
  return useMobileTheme().effects;
}
