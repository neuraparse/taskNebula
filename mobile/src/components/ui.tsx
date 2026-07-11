/**
 * TaskNebula Mobile UI kit — small React Native primitives that mirror the web
 * design system (square-ish radii, semantic tokens, dark-mode-first). Import
 * from '@/components/ui'.
 */
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from '@/components/native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { ThemeColors, ThemeEffects } from '@/design/theme';
import { useMobileTheme, useThemeColors } from '@/design/theme-context';

/** Full-bleed themed screen container with safe-area insets. */
export function Screen({ children, className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <View className={`bg-background flex-1 ${className}`} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

export function Card({ children, className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={`border-border bg-card rounded-lg border p-4 ${className}`} {...rest}>
      {children}
    </View>
  );
}

type Tone = 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'neutral';

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function toneColor(colors: ThemeColors, tone: Tone): string {
  const toneMap: Record<Tone, string> = {
    blue: colors.accentBlue,
    violet: colors.accentViolet,
    cyan: colors.accentCyan,
    emerald: colors.accentEmerald,
    amber: colors.accentAmber,
    rose: colors.accentRose,
    indigo: colors.accentIndigo,
    neutral: colors.mutedForeground,
  };
  return toneMap[tone];
}

function toneSurfaceStyle(
  colors: ThemeColors,
  color: string,
  effects: ThemeEffects,
  backgroundOpacity: string,
  borderOpacity: string,
): { backgroundColor: string; borderColor: string } {
  if (!effects.gradientsEnabled) {
    return { backgroundColor: colors.surface2, borderColor: colors.border };
  }

  return {
    backgroundColor: alpha(color, backgroundOpacity),
    borderColor: alpha(color, borderOpacity),
  };
}

export function ScreenHeader({
  kicker,
  title,
  subtitle,
  meta,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
}) {
  return (
    <View className="gap-2 px-4 pb-3 pt-5">
      {kicker ? (
        <Text className="text-primary text-xs font-semibold" style={styles.headerKicker}>
          {kicker}
        </Text>
      ) : null}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-foreground text-2xl font-semibold" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-muted-foreground text-sm leading-5" numberOfLines={3}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {meta ? <View className="items-end">{meta}</View> : null}
      </View>
    </View>
  );
}

export function SemanticBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors, effects } = useMobileTheme();
  const color = toneColor(colors, tone);
  return (
    <View
      className="self-start rounded-sm border px-2 py-0.5"
      style={toneSurfaceStyle(colors, color, effects, '1A', '33')}
    >
      <Text className="text-xs font-medium" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function IconTile({ icon: Icon, tone = 'blue' }: { icon: LucideIcon; tone?: Tone }) {
  const { colors, effects } = useMobileTheme();
  const color = toneColor(colors, tone);
  return (
    <View
      className="h-10 w-10 items-center justify-center rounded-lg border"
      style={toneSurfaceStyle(colors, color, effects, '14', '2E')}
    >
      <Icon size={18} color={color} />
    </View>
  );
}

export function SurfaceRow({
  children,
  onLayout,
  onPress,
  className = '',
}: {
  children: ReactNode;
  onLayout?: ViewProps['onLayout'];
  onPress?: () => void;
  className?: string;
}) {
  const rowClassName = `rounded-lg border border-border bg-card p-4 ${className}`;
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onLayout={onLayout}
        onPress={onPress}
        className={`active:opacity-80 ${rowClassName}`}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View onLayout={onLayout} className={rowClassName}>
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: LucideIcon;
}

const BTN: Record<ButtonVariant, { box: string; label: string }> = {
  primary: { box: 'bg-primary', label: 'text-primary-foreground' },
  secondary: { box: 'bg-secondary', label: 'text-secondary-foreground' },
  ghost: { box: 'bg-transparent', label: 'text-foreground' },
  destructive: { box: 'bg-destructive', label: 'text-destructive-foreground' },
};

function buttonIconColor(colors: ThemeColors, variant: ButtonVariant): string {
  const iconMap: Record<ButtonVariant, string> = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    ghost: colors.foreground,
    destructive: colors.destructiveForeground,
  };
  return iconMap[variant];
}

export function Button({
  title,
  variant = 'primary',
  loading,
  icon: Icon,
  disabled,
  ...rest
}: ButtonProps) {
  const s = BTN[variant];
  const colors = useThemeColors();
  const iconColor = buttonIconColor(colors, variant);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-md px-4 active:opacity-80 ${s.box} ${
        disabled || loading ? 'opacity-50' : ''
      }`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={iconColor} /> : null}
          <Text className={`text-base font-semibold ${s.label}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  className?: string | undefined;
  label?: string | undefined;
  error?: string | undefined;
}
export const TextField = forwardRef<ComponentRef<typeof TextInput>, FieldProps>(
  function TextFieldInput({ label, error, className = '', ...rest }, ref) {
    const colors = useThemeColors();
    return (
      <View className="gap-1.5">
        {label ? <Text className="text-foreground text-sm font-medium">{label}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.mutedForeground}
          className={`bg-card text-foreground h-12 rounded-md border px-3 text-base ${
            error ? 'border-destructive' : 'border-input'
          } ${className}`}
          {...rest}
        />
        {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
      </View>
    );
  },
);

export function Badge({ label, className = '' }: { label: string; className?: string }) {
  return (
    <View className={`bg-muted rounded-sm px-2 py-0.5 ${className}`}>
      <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
    </View>
  );
}

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-primary items-center justify-center"
    >
      <Text className="text-primary-foreground text-xs font-bold">{initials}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const colors = useThemeColors();
  return (
    <View className="bg-background flex-1 items-center justify-center gap-3 p-8">
      <ActivityIndicator color={colors.primary} />
      {label ? <Text className="text-muted-foreground text-sm">{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center gap-2 p-10">
      {Icon ? <Icon size={40} color={colors.mutedForeground} /> : null}
      <Text className="text-foreground text-center text-base font-semibold">{title}</Text>
      {description ? (
        <Text className="text-muted-foreground text-center text-sm">{description}</Text>
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center gap-3 p-10">
      <Text className="text-destructive text-center text-base font-semibold">{message}</Text>
      {onRetry ? <Button title={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerKicker: {
    letterSpacing: 0,
  },
});
