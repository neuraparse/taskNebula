import {
  forwardRef,
  type ComponentProps,
  type ComponentRef,
  type ForwardedRef,
  type ReactElement,
} from 'react';
import * as RN from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

import { colors, radii } from '@/design/tokens';
import type { ThemeColors, ThemeEffects, ThemeTypography } from '@/design/theme';
import { useMobileTheme } from '@/design/theme-context';

type NativeStyle = RN.ViewStyle & RN.TextStyle;

function paletteFromColors(themeColors: ThemeColors): Record<string, string> {
  return {
    background: themeColors.background,
    card: themeColors.card,
    foreground: themeColors.foreground,
    muted: themeColors.muted,
    'muted-foreground': themeColors.mutedForeground,
    accent: themeColors.accent,
    'accent-foreground': themeColors.accentForeground,
    border: themeColors.border,
    'border-strong': themeColors.borderStrong,
    input: themeColors.input,
    ring: themeColors.ring,
    primary: themeColors.primary,
    'primary-foreground': themeColors.primaryForeground,
    secondary: themeColors.secondary,
    'secondary-foreground': themeColors.secondaryForeground,
    success: themeColors.success,
    destructive: themeColors.destructive,
    'destructive-foreground': themeColors.destructiveForeground,
    surface: themeColors.surface,
    'surface-2': themeColors.surface2,
    info: themeColors.info,
    warning: themeColors.warning,
    'accent-blue': themeColors.accentBlue,
    'accent-violet': themeColors.accentViolet,
    'accent-cyan': themeColors.accentCyan,
    'accent-emerald': themeColors.accentEmerald,
    'accent-amber': themeColors.accentAmber,
    'accent-rose': themeColors.accentRose,
    'accent-indigo': themeColors.accentIndigo,
    'purple-500': themeColors.accentViolet,
    'green-500': themeColors.accentEmerald,
    'blue-500': themeColors.accentBlue,
    'red-500': themeColors.destructive,
    'red-600': themeColors.destructive,
    'cyan-500': themeColors.accentCyan,
    'amber-500': themeColors.accentAmber,
    'orange-500': themeColors.warning,
  };
}

const defaultPalette = paletteFromColors(colors);

const spacing: Record<string, number> = {
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
};

const textSizes: Record<string, Pick<RN.TextStyle, 'fontSize' | 'lineHeight'>> = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
};

function applySpacing(style: NativeStyle, key: string, value: number): boolean {
  const map: Record<string, (v: number) => void> = {
    p: (v) => {
      style.padding = v;
    },
    px: (v) => {
      style.paddingHorizontal = v;
    },
    py: (v) => {
      style.paddingVertical = v;
    },
    pt: (v) => {
      style.paddingTop = v;
    },
    pb: (v) => {
      style.paddingBottom = v;
    },
    mt: (v) => {
      style.marginTop = v;
    },
    mb: (v) => {
      style.marginBottom = v;
    },
    mx: (v) => {
      style.marginHorizontal = v;
    },
    my: (v) => {
      style.marginVertical = v;
    },
  };
  const set = map[key];
  if (!set) return false;
  set(value);
  return true;
}

function applyToken(
  style: NativeStyle,
  rawToken: string,
  pressed: boolean,
  palette: Record<string, string>,
  typography?: ThemeTypography,
  effects?: ThemeEffects,
): void {
  let token = rawToken.trim();
  if (!token) return;
  if (token.startsWith('active:')) {
    if (!pressed || effects?.animationsEnabled === false) return;
    token = token.slice('active:'.length);
  }

  if (token === 'flex-1') {
    style.flex = 1;
    return;
  }
  if (token === 'flex-row') {
    style.flexDirection = 'row';
    return;
  }
  if (token === 'flex-wrap') {
    style.flexWrap = 'wrap';
    return;
  }
  if (token === 'items-center') {
    style.alignItems = 'center';
    return;
  }
  if (token === 'items-start') {
    style.alignItems = 'flex-start';
    return;
  }
  if (token === 'items-end') {
    style.alignItems = 'flex-end';
    return;
  }
  if (token === 'self-start') {
    style.alignSelf = 'flex-start';
    return;
  }
  if (token === 'justify-center') {
    style.justifyContent = 'center';
    return;
  }
  if (token === 'justify-between') {
    style.justifyContent = 'space-between';
    return;
  }
  if (token === 'text-center') {
    style.textAlign = 'center';
    return;
  }
  if (token === 'font-mono') {
    style.fontFamily = typography?.monoFontFamily ?? 'monospace';
    return;
  }
  if (token === 'font-medium') {
    if (typography) style.fontFamily = typography.mediumFontFamily;
    else style.fontWeight = '500';
    return;
  }
  if (token === 'font-semibold') {
    if (typography) style.fontFamily = typography.semiboldFontFamily;
    else style.fontWeight = '600';
    return;
  }
  if (token === 'font-bold') {
    if (typography) style.fontFamily = typography.boldFontFamily;
    else style.fontWeight = '700';
    return;
  }
  if (token === 'leading-5') {
    style.lineHeight = 20;
    return;
  }
  if (token === 'border') {
    style.borderWidth = RN.StyleSheet.hairlineWidth;
    return;
  }
  if (token === 'border-b') {
    style.borderBottomWidth = RN.StyleSheet.hairlineWidth;
    return;
  }
  if (token === 'border-t') {
    style.borderTopWidth = RN.StyleSheet.hairlineWidth;
    return;
  }
  if (token === 'rounded-sm') {
    style.borderRadius = radii.sm;
    return;
  }
  if (token === 'rounded-md') {
    style.borderRadius = radii.md;
    return;
  }
  if (token === 'rounded-lg') {
    style.borderRadius = radii.lg;
    return;
  }
  if (token === 'rounded-full') {
    style.borderRadius = 9999;
    return;
  }
  if (token === 'bg-transparent') {
    style.backgroundColor = 'transparent';
    return;
  }

  const [maybePrefix, value] = token.split('-', 2);
  const prefix = maybePrefix ?? '';
  const tail = token.slice(prefix.length + 1);
  const space = spacing[tail];
  if (space !== undefined) {
    if (applySpacing(style, prefix, space)) return;
    if (prefix === 'gap') {
      style.gap = space;
      return;
    }
    if (prefix === 'h') {
      style.height = space;
      return;
    }
    if (prefix === 'w') {
      style.width = space;
      return;
    }
  }
  if (prefix === 'min' && value === 'h') {
    const minHeight = spacing[token.slice('min-h-'.length)];
    if (minHeight !== undefined) {
      style.minHeight = minHeight;
      return;
    }
  }
  if (prefix === 'min' && value === 'w' && token === 'min-w-0') {
    style.minWidth = 0;
    return;
  }
  if (prefix === 'text' && textSizes[tail]) {
    Object.assign(style, textSizes[tail]);
    return;
  }
  if (prefix === 'text' && palette[tail]) {
    style.color = palette[tail];
    return;
  }
  if (prefix === 'bg' && palette[tail]) {
    style.backgroundColor = palette[tail];
    return;
  }
  if (prefix === 'border' && palette[tail]) {
    style.borderColor = palette[tail];
    return;
  }
  if (prefix === 'opacity' && tail === '50') {
    style.opacity = 0.5;
    return;
  }
  if (prefix === 'opacity' && tail === '70') {
    style.opacity = 0.7;
    return;
  }
  if (prefix === 'opacity' && tail === '80') {
    style.opacity = 0.8;
  }
}

export function classNameToStyle(
  className?: string,
  pressed = false,
  themeColors: ThemeColors = colors,
  typography?: ThemeTypography,
  effects?: ThemeEffects,
): NativeStyle {
  const style: NativeStyle = {};
  const palette = themeColors === colors ? defaultPalette : paletteFromColors(themeColors);
  className
    ?.split(/\s+/)
    .filter(Boolean)
    .forEach((token) => applyToken(style, token, pressed, palette, typography, effects));
  return style;
}

function typographyStyle(typography: ThemeTypography): RN.TextStyle {
  return { fontFamily: typography.fontFamily };
}

type StyledProps<P, S> = Omit<P, 'style'> & {
  className?: string;
  style?: RN.StyleProp<S>;
};

export const View = forwardRef<
  ComponentRef<typeof RN.View>,
  StyledProps<RN.ViewProps, RN.ViewStyle>
>(({ className, style, ...props }, ref) => {
  const { colors: themeColors } = useMobileTheme();
  return (
    <RN.View
      ref={ref}
      style={[classNameToStyle(className, false, themeColors), style]}
      {...props}
    />
  );
});

export const Text = forwardRef<
  ComponentRef<typeof RN.Text>,
  StyledProps<RN.TextProps, RN.TextStyle>
>(({ className, style, ...props }, ref) => {
  const { colors: themeColors, typography } = useMobileTheme();
  return (
    <RN.Text
      ref={ref}
      style={[
        typographyStyle(typography),
        classNameToStyle(className, false, themeColors, typography),
        style,
      ]}
      {...props}
    />
  );
});

type StyledPressableProps = Omit<RN.PressableProps, 'style'> & {
  className?: string;
  style?: RN.PressableProps['style'];
};

export const Pressable = forwardRef<ComponentRef<typeof RN.Pressable>, StyledPressableProps>(
  ({ className, style, ...props }, ref) => {
    const { colors: themeColors, effects } = useMobileTheme();
    return (
      <RN.Pressable
        ref={ref}
        style={(state) => [
          classNameToStyle(className, state.pressed, themeColors, undefined, effects),
          typeof style === 'function' ? style(state) : style,
        ]}
        {...props}
      />
    );
  },
);

export const KeyboardAvoidingView = forwardRef<
  ComponentRef<typeof RN.KeyboardAvoidingView>,
  StyledProps<RN.KeyboardAvoidingViewProps, RN.ViewStyle>
>(({ className, style, ...props }, ref) => {
  const { colors: themeColors } = useMobileTheme();
  return (
    <RN.KeyboardAvoidingView
      ref={ref}
      style={[classNameToStyle(className, false, themeColors), style]}
      {...props}
    />
  );
});

type StyledScrollViewProps = Omit<RN.ScrollViewProps, 'style' | 'contentContainerStyle'> & {
  className?: string;
  contentContainerClassName?: string;
  style?: RN.StyleProp<RN.ViewStyle>;
  contentContainerStyle?: RN.StyleProp<RN.ViewStyle>;
};

export const ScrollView = forwardRef<ComponentRef<typeof RN.ScrollView>, StyledScrollViewProps>(
  ({ className, contentContainerClassName, contentContainerStyle, style, ...props }, ref) => {
    const { colors: themeColors } = useMobileTheme();
    return (
      <RN.ScrollView
        ref={ref}
        style={[classNameToStyle(className, false, themeColors), style]}
        contentContainerStyle={[
          classNameToStyle(contentContainerClassName, false, themeColors),
          contentContainerStyle,
        ]}
        {...props}
      />
    );
  },
);

type StyledTextInputProps = Omit<RN.TextInputProps, 'style'> & {
  className?: string;
  style?: RN.StyleProp<RN.TextStyle>;
};

export const TextInput = forwardRef<ComponentRef<typeof RN.TextInput>, StyledTextInputProps>(
  ({ className, style, ...props }, ref) => {
    const { colors: themeColors, typography } = useMobileTheme();
    return (
      <RN.TextInput
        ref={ref}
        style={[
          typographyStyle(typography),
          classNameToStyle(className, false, themeColors, typography),
          style,
        ]}
        {...props}
      />
    );
  },
);

type StyledSafeAreaViewProps = Omit<ComponentProps<typeof RNSafeAreaView>, 'style'> & {
  className?: string;
  style?: RN.StyleProp<RN.ViewStyle>;
};

export const SafeAreaView = forwardRef<
  ComponentRef<typeof RNSafeAreaView>,
  StyledSafeAreaViewProps
>(({ className, style, ...props }, ref) => {
  const { colors: themeColors } = useMobileTheme();
  return (
    <RNSafeAreaView
      ref={ref}
      style={[classNameToStyle(className, false, themeColors), style]}
      {...props}
    />
  );
});

type StyledFlatListProps<ItemT> = Omit<
  RN.FlatListProps<ItemT>,
  'style' | 'contentContainerStyle'
> & {
  className?: string;
  contentContainerClassName?: string;
  style?: RN.StyleProp<RN.ViewStyle>;
  contentContainerStyle?: RN.StyleProp<RN.ViewStyle>;
};

function FlatListInner<ItemT>(
  {
    className,
    contentContainerClassName,
    contentContainerStyle,
    style,
    ...props
  }: StyledFlatListProps<ItemT>,
  ref: ForwardedRef<RN.FlatList<ItemT>>,
) {
  const { colors: themeColors } = useMobileTheme();
  return (
    <RN.FlatList
      ref={ref}
      style={[classNameToStyle(className, false, themeColors), style]}
      contentContainerStyle={[
        classNameToStyle(contentContainerClassName, false, themeColors),
        contentContainerStyle,
      ]}
      {...props}
    />
  );
}

export const FlatList = forwardRef(FlatListInner) as <ItemT>(
  props: StyledFlatListProps<ItemT> & { ref?: ForwardedRef<RN.FlatList<ItemT>> },
) => ReactElement;

export const { ActivityIndicator, Platform, RefreshControl, StyleSheet } = RN;
export type { ListRenderItem, PressableProps, TextInputProps, ViewProps } from 'react-native';
