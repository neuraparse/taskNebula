import { useEffect, useMemo, useState } from 'react';
import { MailCheck, RefreshCw, Send, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { refreshEmailVerification, requestEmailVerification } from '@/api/auth';
import { Pressable, StyleSheet, Text, View } from '@/components/native';
import { useThemeColors } from '@/design/theme-context';
import { mmkv } from '@/lib/storage';
import { useSession } from '@/stores/session';

const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ActionState = 'idle' | 'sending' | 'checking';
type BannerMessage = { tone: 'success' | 'error'; text: string } | null;

function bannerDismissKey(serverUrl: string | null, userId: string | undefined): string | null {
  if (!serverUrl || !userId) return null;
  return `email_verification_banner_dismissed_until::${serverUrl}::${userId}`;
}

function isDismissed(key: string | null): boolean {
  if (!key) return false;
  const dismissedUntil = mmkv.getNumber(key) ?? 0;
  return Number.isFinite(dismissedUntil) && Date.now() < dismissedUntil;
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

function BannerAction({
  disabled,
  icon: Icon,
  label,
  onPress,
}: {
  disabled: boolean;
  icon: typeof Send;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        { backgroundColor: colors.primary },
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Icon size={14} color={colors.primaryForeground} />
      <Text style={[styles.actionText, { color: colors.primaryForeground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmailVerificationBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const serverUrl = useSession((s) => s.serverUrl);
  const refreshUser = useSession((s) => s.refreshUser);

  const dismissKey = useMemo(() => bannerDismissKey(serverUrl, user?.id), [serverUrl, user?.id]);
  const shouldShow = status === 'authenticated' && user?.emailVerificationRequired === true;
  const [visible, setVisible] = useState(false);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<BannerMessage>(null);

  useEffect(() => {
    setMessage(null);
    setActionState('idle');
    setVisible(shouldShow && !isDismissed(dismissKey));
  }, [dismissKey, shouldShow]);

  const busy = actionState !== 'idle';

  const dismiss = () => {
    if (dismissKey) mmkv.set(dismissKey, Date.now() + DISMISS_TTL_MS);
    setVisible(false);
  };

  const resend = async () => {
    if (!user?.email || busy) return;
    setMessage(null);
    setActionState('sending');
    try {
      await requestEmailVerification(user.email);
      setMessage({ tone: 'success', text: t('verificationBanner.sent') });
    } catch {
      setMessage({ tone: 'error', text: t('verificationBanner.sendFailed') });
    } finally {
      setActionState('idle');
    }
  };

  const refresh = async () => {
    if (busy) return;
    setMessage(null);
    setActionState('checking');
    try {
      const result = await refreshEmailVerification();
      if (result.verified) {
        await refreshUser();
        setVisible(false);
        return;
      }
      setMessage({ tone: 'error', text: t('verificationBanner.notVerified') });
    } catch {
      setMessage({ tone: 'error', text: t('verificationBanner.refreshFailed') });
    } finally {
      setActionState('idle');
    }
  };

  if (!visible || !user) return null;

  const accent = colors.accentIndigo;

  return (
    <View
      style={[
        styles.banner,
        {
          borderBottomColor: alpha(accent, '33'),
          backgroundColor: alpha(accent, '14'),
        },
      ]}
      accessibilityRole="summary"
    >
      <View
        style={[
          styles.iconBox,
          {
            borderColor: alpha(accent, '33'),
            backgroundColor: alpha(accent, '1F'),
          },
        ]}
      >
        <MailCheck size={18} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {t('verificationBanner.title')}
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {t('verificationBanner.description')}
        </Text>
        {message ? (
          <Text
            style={[
              styles.message,
              { color: message.tone === 'error' ? colors.destructive : colors.success },
            ]}
            numberOfLines={2}
          >
            {message.text}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <BannerAction
            disabled={busy}
            icon={Send}
            label={
              actionState === 'sending'
                ? t('verificationBanner.sending')
                : t('verificationBanner.resend')
            }
            onPress={() => {
              void resend();
            }}
          />
          <BannerAction
            disabled={busy}
            icon={RefreshCw}
            label={
              actionState === 'checking'
                ? t('verificationBanner.checking')
                : t('verificationBanner.alreadyVerified')
            }
            onPress={() => {
              void refresh();
            }}
          />
        </View>
      </View>
      <Pressable
        accessibilityLabel={t('verificationBanner.dismiss')}
        accessibilityRole="button"
        onPress={dismiss}
        style={styles.dismiss}
        className="active:opacity-80"
      >
        <X size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconBox: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  action: {
    minHeight: 34,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  disabled: {
    opacity: 0.55,
  },
  dismiss: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
});
