import type { Theme } from '@react-navigation/native';

import type {
  UserAppearanceColorTheme,
  UserAppearanceInterfaceFont,
  UserAppearanceSettings,
  UserAppearanceTheme,
  UserAppearanceVisualStyle,
} from '@/api/types';
import { colors as tokenColors } from '@/design/tokens';

export type ThemeColors = Record<keyof typeof tokenColors, string>;
export type ResolvedColorMode = 'light' | 'dark';
export type SystemColorScheme = ResolvedColorMode | null | undefined;

export type AppearanceThemeInput =
  | Partial<
      Pick<
        UserAppearanceSettings,
        | 'theme'
        | 'colorTheme'
        | 'visualStyle'
        | 'interfaceFont'
        | 'animationsEnabled'
        | 'gradientsEnabled'
      >
    >
  | null
  | undefined;

export interface MobileRuntimeTheme {
  dark: boolean;
  colorMode: ResolvedColorMode;
  colors: ThemeColors;
  typography: ThemeTypography;
  effects: ThemeEffects;
  navigationTheme: Theme;
  statusBarStyle: 'light-content' | 'dark-content';
}

export interface ThemeFontFamilySet {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  monoRegular: string;
  monoMedium: string;
}

export interface ThemeTypography {
  interfaceFont: UserAppearanceInterfaceFont;
  fonts: ThemeFontFamilySet;
  fontFamily: string;
  mediumFontFamily: string;
  semiboldFontFamily: string;
  boldFontFamily: string;
  monoFontFamily: string;
  monoMediumFontFamily: string;
}

export interface ThemeEffects {
  animationsEnabled: boolean;
  gradientsEnabled: boolean;
}

const USER_APPEARANCE_THEMES: readonly UserAppearanceTheme[] = ['light', 'dark', 'system'];
const USER_APPEARANCE_COLOR_THEMES: readonly UserAppearanceColorTheme[] = [
  'default',
  'ocean',
  'forest',
  'sunset',
  'purple',
  'rose',
];
const USER_APPEARANCE_VISUAL_STYLES: readonly UserAppearanceVisualStyle[] = [
  'modern',
  'minimal',
  'glass',
];
const USER_APPEARANCE_INTERFACE_FONTS: readonly UserAppearanceInterfaceFont[] = ['brand', 'ibm'];

const lightColors: ThemeColors = {
  background: '#fcfcfd',
  foreground: '#14171f',
  card: '#ffffff',
  surface: '#f9fafb',
  surface2: '#f3f4f7',
  muted: '#f3f4f6',
  mutedForeground: '#6c727f',
  accent: '#eeeff2',
  accentForeground: '#242938',
  border: '#e2e4e9',
  borderStrong: '#cbcfd8',
  input: '#e2e4e9',
  ring: '#3c83f6',
  primary: '#3c83f6',
  primaryForeground: '#ffffff',
  secondary: '#f3f4f6',
  secondaryForeground: '#242938',
  success: '#22b47f',
  warning: '#eb910a',
  destructive: '#e33535',
  destructiveForeground: '#ffffff',
  info: '#2385f6',
  accentBlue: '#2385f6',
  accentViolet: '#8f51ec',
  accentCyan: '#1ab8d1',
  accentEmerald: '#22b47f',
  accentAmber: '#f6a123',
  accentRose: '#ef4366',
  accentIndigo: '#494fe9',
};

const colorThemePrimary: Record<UserAppearanceColorTheme, Record<ResolvedColorMode, string>> = {
  default: { light: lightColors.primary, dark: tokenColors.primary },
  ocean: { light: '#07b6d5', dark: '#20d3ee' },
  forest: { light: '#16a249', dark: '#21c45d' },
  sunset: { light: '#f97015', dark: '#f98f48' },
  purple: { light: '#a855f7', dark: '#bf83fc' },
  rose: { light: '#e21d4b', dark: '#ef436b' },
};

const colorThemePrimaryForeground: Record<
  UserAppearanceColorTheme,
  Record<ResolvedColorMode, string>
> = {
  default: { light: lightColors.primaryForeground, dark: tokenColors.primaryForeground },
  ocean: { light: '#ffffff', dark: '#032a30' },
  forest: { light: '#ffffff', dark: '#052e14' },
  sunset: { light: '#ffffff', dark: '#301503' },
  purple: { light: '#ffffff', dark: '#1a0330' },
  rose: { light: '#ffffff', dark: '#30030d' },
};

const interfaceFontFamilies: Record<UserAppearanceInterfaceFont, ThemeFontFamilySet> = {
  brand: {
    regular: 'TaskNebulaPlusJakartaSans-Regular',
    medium: 'TaskNebulaPlusJakartaSans-Medium',
    semibold: 'TaskNebulaPlusJakartaSans-SemiBold',
    bold: 'TaskNebulaPlusJakartaSans-Bold',
    monoRegular: 'TaskNebulaJetBrainsMono-Regular',
    monoMedium: 'TaskNebulaJetBrainsMono-Medium',
  },
  ibm: {
    regular: 'TaskNebulaIBMPlexSans-Regular',
    medium: 'TaskNebulaIBMPlexSans-Medium',
    semibold: 'TaskNebulaIBMPlexSans-SemiBold',
    bold: 'TaskNebulaIBMPlexSans-SemiBold',
    monoRegular: 'TaskNebulaIBMPlexMono-Regular',
    monoMedium: 'TaskNebulaIBMPlexMono-Medium',
  },
};

function isAppearanceTheme(value: unknown): value is UserAppearanceTheme {
  return typeof value === 'string' && USER_APPEARANCE_THEMES.includes(value as UserAppearanceTheme);
}

function isColorTheme(value: unknown): value is UserAppearanceColorTheme {
  return (
    typeof value === 'string' &&
    USER_APPEARANCE_COLOR_THEMES.includes(value as UserAppearanceColorTheme)
  );
}

function isVisualStyle(value: unknown): value is UserAppearanceVisualStyle {
  return (
    typeof value === 'string' &&
    USER_APPEARANCE_VISUAL_STYLES.includes(value as UserAppearanceVisualStyle)
  );
}

function isInterfaceFont(value: unknown): value is UserAppearanceInterfaceFont {
  return (
    typeof value === 'string' &&
    USER_APPEARANCE_INTERFACE_FONTS.includes(value as UserAppearanceInterfaceFont)
  );
}

function resolveColorMode(
  theme: UserAppearanceTheme | undefined,
  systemScheme: SystemColorScheme,
): ResolvedColorMode {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemScheme === 'light' ? 'light' : 'dark';
}

function applyVisualStyle(
  palette: ThemeColors,
  visualStyle: UserAppearanceVisualStyle,
  colorMode: ResolvedColorMode,
): ThemeColors {
  if (visualStyle === 'minimal') {
    const border = colorMode === 'light' ? '#ccd6e2' : '#30323a';
    return {
      ...palette,
      card: palette.background,
      surface: colorMode === 'light' ? '#f2f5f9' : '#141519',
      border,
      input: border,
    };
  }

  if (visualStyle === 'glass') {
    return {
      ...palette,
      card: colorMode === 'light' ? '#ffffffE6' : '#141519E6',
      surface: colorMode === 'light' ? '#ffffffB8' : '#17181DCC',
      surface2: colorMode === 'light' ? '#eef2f7D9' : '#202229D9',
    };
  }

  return palette;
}

function createTypography(interfaceFont: UserAppearanceInterfaceFont): ThemeTypography {
  const fonts = interfaceFontFamilies[interfaceFont] ?? interfaceFontFamilies.ibm;
  return {
    interfaceFont,
    fonts,
    fontFamily: fonts.regular,
    mediumFontFamily: fonts.medium,
    semiboldFontFamily: fonts.semibold,
    boldFontFamily: fonts.bold,
    monoFontFamily: fonts.monoRegular,
    monoMediumFontFamily: fonts.monoMedium,
  };
}

function booleanPreference(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function createEffects(settings: AppearanceThemeInput): ThemeEffects {
  return {
    animationsEnabled: booleanPreference(settings?.animationsEnabled, true),
    gradientsEnabled: booleanPreference(settings?.gradientsEnabled, true),
  };
}

function createNavigationTheme(
  colors: ThemeColors,
  colorMode: ResolvedColorMode,
  typography: ThemeTypography,
): Theme {
  return {
    dark: colorMode === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: colors.destructive,
    },
    fonts: {
      regular: { fontFamily: typography.fontFamily, fontWeight: '400' },
      medium: { fontFamily: typography.mediumFontFamily, fontWeight: '500' },
      bold: { fontFamily: typography.boldFontFamily, fontWeight: '700' },
      heavy: { fontFamily: typography.boldFontFamily, fontWeight: '700' },
    },
  };
}

export function createMobileTheme(
  settings: AppearanceThemeInput,
  systemScheme: SystemColorScheme = 'dark',
): MobileRuntimeTheme {
  const preferredTheme = isAppearanceTheme(settings?.theme) ? settings.theme : 'system';
  const colorTheme = isColorTheme(settings?.colorTheme) ? settings.colorTheme : 'default';
  const visualStyle = isVisualStyle(settings?.visualStyle) ? settings.visualStyle : 'modern';
  const interfaceFont = isInterfaceFont(settings?.interfaceFont) ? settings.interfaceFont : 'ibm';
  const colorMode = resolveColorMode(preferredTheme, systemScheme);
  const primary = colorThemePrimary[colorTheme][colorMode];
  const primaryForeground = colorThemePrimaryForeground[colorTheme][colorMode];
  const baseColors = colorMode === 'light' ? lightColors : tokenColors;
  const typography = createTypography(interfaceFont);
  const effects = createEffects(settings);
  const colors = applyVisualStyle(
    {
      ...baseColors,
      primary,
      primaryForeground,
      ring: primary,
    },
    visualStyle,
    colorMode,
  );

  return {
    dark: colorMode === 'dark',
    colorMode,
    colors,
    typography,
    effects,
    navigationTheme: createNavigationTheme(colors, colorMode, typography),
    statusBarStyle: colorMode === 'dark' ? 'light-content' : 'dark-content',
  };
}

export const defaultMobileTheme = createMobileTheme(undefined, 'dark');
