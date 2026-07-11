jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  FlatList: 'FlatList',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { hairlineWidth: 0.5 },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

import { classNameToStyle } from './native';
import { createMobileTheme } from '@/design/theme';

describe('native className adapter', () => {
  it('maps semantic color utilities through the runtime mobile theme', () => {
    const theme = createMobileTheme(
      { theme: 'dark', colorTheme: 'rose', visualStyle: 'glass' },
      'dark',
    );

    expect(
      classNameToStyle('bg-primary text-primary-foreground border-border', false, theme.colors),
    ).toMatchObject({
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.border,
      color: theme.colors.primaryForeground,
    });

    expect(classNameToStyle('bg-card text-muted-foreground', false, theme.colors)).toMatchObject({
      backgroundColor: theme.colors.card,
      color: theme.colors.mutedForeground,
    });

    expect(classNameToStyle('bg-accent text-accent-foreground', false, theme.colors)).toMatchObject(
      {
        backgroundColor: theme.colors.accent,
        color: theme.colors.accentForeground,
      },
    );

    expect(classNameToStyle('border-input', false, theme.colors)).toMatchObject({
      borderColor: theme.colors.input,
    });

    expect(classNameToStyle('border-ring', false, theme.colors)).toMatchObject({
      borderColor: theme.colors.ring,
    });
  });

  it('maps legacy issue color aliases to semantic accent tokens', () => {
    const theme = createMobileTheme({ theme: 'light', colorTheme: 'ocean' }, 'light');

    expect(classNameToStyle('text-purple-500', false, theme.colors)).toMatchObject({
      color: theme.colors.accentViolet,
    });
    expect(classNameToStyle('text-green-500', false, theme.colors)).toMatchObject({
      color: theme.colors.accentEmerald,
    });
    expect(classNameToStyle('text-blue-500', false, theme.colors)).toMatchObject({
      color: theme.colors.accentBlue,
    });
    expect(classNameToStyle('text-red-500', false, theme.colors)).toMatchObject({
      color: theme.colors.destructive,
    });
    expect(classNameToStyle('text-cyan-500', false, theme.colors)).toMatchObject({
      color: theme.colors.accentCyan,
    });
    expect(classNameToStyle('text-amber-500', false, theme.colors)).toMatchObject({
      color: theme.colors.accentAmber,
    });
    expect(classNameToStyle('text-orange-500', false, theme.colors)).toMatchObject({
      color: theme.colors.warning,
    });
  });

  it('maps font utilities to the runtime native font families', () => {
    const brand = createMobileTheme({ interfaceFont: 'brand' }, 'dark');
    const ibm = createMobileTheme({ interfaceFont: 'ibm' }, 'dark');

    expect(classNameToStyle('font-medium', false, brand.colors, brand.typography)).toMatchObject({
      fontFamily: 'TaskNebulaPlusJakartaSans-Medium',
    });
    expect(classNameToStyle('font-semibold', false, brand.colors, brand.typography)).toMatchObject({
      fontFamily: 'TaskNebulaPlusJakartaSans-SemiBold',
    });
    expect(classNameToStyle('font-bold', false, brand.colors, brand.typography)).toMatchObject({
      fontFamily: 'TaskNebulaPlusJakartaSans-Bold',
    });
    expect(classNameToStyle('font-mono', false, brand.colors, brand.typography)).toMatchObject({
      fontFamily: 'TaskNebulaJetBrainsMono-Regular',
    });
    expect(classNameToStyle('font-mono', false, ibm.colors, ibm.typography)).toMatchObject({
      fontFamily: 'TaskNebulaIBMPlexMono-Regular',
    });
  });

  it('applies pressed-only active utilities without affecting the default state', () => {
    const theme = createMobileTheme({ theme: 'light', colorTheme: 'forest' }, 'light');
    const reducedMotion = createMobileTheme(
      { theme: 'light', colorTheme: 'forest', animationsEnabled: false },
      'light',
    );

    expect(classNameToStyle('active:opacity-80 bg-primary', false, theme.colors)).toMatchObject({
      backgroundColor: theme.colors.primary,
    });
    expect(
      classNameToStyle('active:opacity-80 bg-primary', false, theme.colors),
    ).not.toHaveProperty('opacity');

    expect(classNameToStyle('active:opacity-80 bg-primary', true, theme.colors)).toMatchObject({
      backgroundColor: theme.colors.primary,
      opacity: 0.8,
    });
    expect(
      classNameToStyle(
        'active:opacity-80 bg-primary',
        true,
        reducedMotion.colors,
        undefined,
        reducedMotion.effects,
      ),
    ).not.toHaveProperty('opacity');
  });

  it('keeps fixed layout utilities stable for dense mobile surfaces', () => {
    expect(
      classNameToStyle('h-12 w-10 min-h-20 min-w-0 flex-wrap gap-2 px-4 py-3 rounded-lg'),
    ).toMatchObject({
      borderRadius: 6,
      flexWrap: 'wrap',
      gap: 8,
      height: 48,
      minHeight: 80,
      minWidth: 0,
      paddingHorizontal: 16,
      paddingVertical: 12,
      width: 40,
    });

    expect(classNameToStyle('min-h-24')).toMatchObject({ minHeight: 96 });
  });
});
