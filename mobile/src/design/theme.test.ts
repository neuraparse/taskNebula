import { colors as darkWebTokenColors } from './tokens';
import { createMobileTheme } from './theme';

describe('mobile runtime theme', () => {
  it('resolves system color mode from the device scheme', () => {
    expect(createMobileTheme({ theme: 'system' }, 'light').colorMode).toBe('light');
    expect(createMobileTheme({ theme: 'system' }, 'dark').colorMode).toBe('dark');
  });

  it('lets explicit user color mode override the device scheme', () => {
    const theme = createMobileTheme({ theme: 'light' }, 'dark');

    expect(theme.dark).toBe(false);
    expect(theme.navigationTheme.dark).toBe(false);
    expect(theme.statusBarStyle).toBe('dark-content');
  });

  it('defaults to the web app IBM interface font stack', () => {
    const theme = createMobileTheme(undefined, 'dark');

    expect(theme.typography.interfaceFont).toBe('ibm');
    expect(theme.typography.fontFamily).toBe('TaskNebulaIBMPlexSans-Regular');
    expect(theme.typography.mediumFontFamily).toBe('TaskNebulaIBMPlexSans-Medium');
    expect(theme.typography.semiboldFontFamily).toBe('TaskNebulaIBMPlexSans-SemiBold');
    expect(theme.typography.boldFontFamily).toBe('TaskNebulaIBMPlexSans-SemiBold');
    expect(theme.typography.monoFontFamily).toBe('TaskNebulaIBMPlexMono-Regular');
    expect(theme.navigationTheme.fonts.regular.fontFamily).toBe('TaskNebulaIBMPlexSans-Regular');
  });

  it('applies the saved brand interface font stack', () => {
    const theme = createMobileTheme({ interfaceFont: 'brand' }, 'dark');

    expect(theme.typography.interfaceFont).toBe('brand');
    expect(theme.typography.fontFamily).toBe('TaskNebulaPlusJakartaSans-Regular');
    expect(theme.typography.mediumFontFamily).toBe('TaskNebulaPlusJakartaSans-Medium');
    expect(theme.typography.semiboldFontFamily).toBe('TaskNebulaPlusJakartaSans-SemiBold');
    expect(theme.typography.boldFontFamily).toBe('TaskNebulaPlusJakartaSans-Bold');
    expect(theme.typography.monoFontFamily).toBe('TaskNebulaJetBrainsMono-Regular');
    expect(theme.navigationTheme.fonts.bold.fontFamily).toBe('TaskNebulaPlusJakartaSans-Bold');
  });

  it('defaults runtime appearance effects to the web appearance settings', () => {
    const theme = createMobileTheme(undefined, 'dark');

    expect(theme.effects).toEqual({
      animationsEnabled: true,
      gradientsEnabled: true,
    });
  });

  it('applies saved runtime appearance effects', () => {
    const theme = createMobileTheme({ animationsEnabled: false, gradientsEnabled: false }, 'dark');

    expect(theme.effects).toEqual({
      animationsEnabled: false,
      gradientsEnabled: false,
    });
  });

  it('applies the saved accent palette to primary UI colors', () => {
    const forest = createMobileTheme({ theme: 'dark', colorTheme: 'forest' }, 'dark');

    expect(forest.colors.primary).toBe('#21c45d');
    expect(forest.colors.primaryForeground).toBe('#052e14');
    expect(forest.colors.ring).toBe('#21c45d');
    expect(forest.colors.accentBlue).toBe(darkWebTokenColors.accentBlue);
    expect(forest.colors.info).toBe(darkWebTokenColors.info);
    expect(forest.navigationTheme.colors.primary).toBe('#21c45d');
  });

  it('keeps the default dark palette aligned with the web design tokens', () => {
    const theme = createMobileTheme({ theme: 'dark' }, 'dark');

    expect(theme.colors).toMatchObject(darkWebTokenColors);
  });

  it('keeps the default light palette aligned with the web design tokens', () => {
    const theme = createMobileTheme({ theme: 'light' }, 'dark');

    expect(theme.colors).toMatchObject({
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
    });
  });

  it('applies visual style variants to shared surface tokens', () => {
    const minimal = createMobileTheme({ theme: 'light', visualStyle: 'minimal' }, 'light');
    const glass = createMobileTheme({ theme: 'dark', visualStyle: 'glass' }, 'dark');

    expect(minimal.colors.card).toBe(minimal.colors.background);
    expect(minimal.colors.input).toBe(minimal.colors.border);
    expect(glass.colors.card).toBe('#141519E6');
  });
});
