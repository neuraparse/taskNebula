import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import { ArrowRight, Server, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, Screen, TextField } from '@/components/ui';
import { normalizeBaseUrl } from '@/api/client';
import { probeServer } from '@/api/auth';
import { useThemeColors } from '@/design/theme-context';
import { useSession } from '@/stores/session';

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'reachable'; version?: string }
  | { kind: 'unreachable'; message: string };

export function ServerScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const connectServer = useSession((s) => s.connectServer);

  const [url, setUrl] = useState('');
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' });

  const normalized = normalizeBaseUrl(url);
  const isInsecure = normalized?.startsWith('http://') ?? false;

  const onConnect = async (): Promise<void> => {
    if (!normalized) return;
    setProbe({ kind: 'checking' });
    try {
      const health = await probeServer(normalized);
      setProbe(
        health.version ? { kind: 'reachable', version: health.version } : { kind: 'reachable' },
      );
      await connectServer(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('onboarding.unreachable');
      setProbe({ kind: 'unreachable', message });
    }
  };

  const checking = probe.kind === 'checking';

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.centeredContent}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10 items-center">
            <View className="bg-primary mb-5 h-16 w-16 items-center justify-center rounded-lg">
              <Server size={30} color={colors.primaryForeground} />
            </View>
            <Text className="text-foreground text-center text-2xl font-bold">
              {t('onboarding.serverTitle')}
            </Text>
            <Text className="text-muted-foreground mt-2 px-4 text-center text-base">
              {t('onboarding.serverSubtitle')}
            </Text>
          </View>

          <View className="gap-4">
            <TextField
              label={t('onboarding.urlLabel')}
              placeholder={t('onboarding.urlPlaceholder')}
              value={url}
              onChangeText={(text: string) => {
                setUrl(text);
                if (probe.kind !== 'idle') setProbe({ kind: 'idle' });
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              editable={!checking}
              onSubmitEditing={() => {
                void onConnect();
              }}
            />

            {isInsecure ? (
              <View className="bg-muted flex-row items-start gap-2 rounded-md px-3 py-2">
                <ShieldAlert size={16} color={colors.warning} />
                <Text className="text-muted-foreground flex-1 text-sm">
                  {t('onboarding.insecureWarning')}
                </Text>
              </View>
            ) : (
              <Text className="text-muted-foreground px-1 text-xs">
                {t('onboarding.httpsHint')}
              </Text>
            )}

            {probe.kind === 'reachable' ? (
              <View className="flex-row items-center gap-2 px-1">
                <ShieldCheck size={16} color={colors.success} />
                <Text className="text-success flex-1 text-sm">
                  {t('onboarding.reachable')} {probe.version ? `(v${probe.version})` : ''}
                </Text>
              </View>
            ) : null}

            {probe.kind === 'unreachable' ? (
              <View className="flex-row items-center gap-2 px-1">
                <ShieldAlert size={16} color={colors.destructive} />
                <Text className="text-destructive flex-1 text-sm">
                  {t('onboarding.unreachable')}: {probe.message}
                </Text>
              </View>
            ) : null}

            <Button
              title={checking ? t('onboarding.checking') : t('onboarding.connect')}
              icon={ArrowRight}
              loading={checking}
              disabled={!normalized || checking}
              onPress={() => {
                void onConnect();
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
