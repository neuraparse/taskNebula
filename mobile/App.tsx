import './src/lib/i18n';

import { useEffect, useRef } from 'react';
import { Linking, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { NetworkBanner } from '@/components/network-banner';
import { MobileThemeProvider, useMobileTheme } from '@/design/theme-context';
import { useUserAppearance } from '@/hooks/queries';
import { persistOptions, queryClient } from '@/lib/query';
import { useSession } from '@/stores/session';
import { useRealtimeSync } from '@/hooks/realtime';
import { AppNavigator } from '@/navigation/AppNavigator';
import { navigationRef } from '@/navigation/root';
import { LoginScreen } from '@/screens/LoginScreen';
import { PublicDocumentScreen } from '@/screens/PublicDocumentScreen';
import { PublicIntakeScreen } from '@/screens/PublicIntakeScreen';
import { ServerScreen } from '@/screens/ServerScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { routeTaskNebulaDeepLink } from '@/lib/deep-link-routing';
import { useAuthIntent } from '@/stores/auth-intent';
import { useContentLinkIntent } from '@/stores/content-link-intent';
import { useNavigationReady } from '@/stores/navigation-ready';

function SessionGate() {
  const hydrate = useSession((s) => s.hydrate);
  const status = useSession((s) => s.status);
  const serverUrl = useSession((s) => s.serverUrl);
  const connectServer = useSession((s) => s.connectServer);
  const setPendingAuthIntent = useAuthIntent((s) => s.setPending);
  const clearPendingAuthIntent = useAuthIntent((s) => s.clear);
  const setPendingContentLink = useContentLinkIntent((s) => s.setPending);
  const clearPendingContentLink = useContentLinkIntent((s) => s.clear);
  const pendingContentLink = useContentLinkIntent((s) => s.pending);
  const consumeContentLink = useContentLinkIntent((s) => s.consume);
  const handledInitialUrlRef = useRef<string | null>(null);
  useRealtimeSync(status === 'authenticated');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status === 'loading') return undefined;

    const handleUrl = (url: string) => {
      void routeTaskNebulaDeepLink(url, {
        currentServerUrl: serverUrl,
        connectServer,
        setPendingAuthIntent,
        setPendingContentLink,
        clearPendingAuthIntent,
        clearPendingContentLink,
      });
    };

    void Linking.getInitialURL().then((url) => {
      if (!url || handledInitialUrlRef.current === url) return;
      handledInitialUrlRef.current = url;
      handleUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [
    clearPendingAuthIntent,
    clearPendingContentLink,
    connectServer,
    serverUrl,
    setPendingAuthIntent,
    setPendingContentLink,
    status,
  ]);

  if (status === 'loading') return <Loading />;
  if (status === 'no-server') return <ServerScreen />;
  if (status === 'setup-required') return <SetupScreen />;
  if (status === 'unauthenticated' && pendingContentLink?.kind === 'public-document') {
    return (
      <PublicDocumentScreen token={pendingContentLink.token} onClose={() => consumeContentLink()} />
    );
  }
  if (status === 'unauthenticated' && pendingContentLink?.kind === 'public-intake') {
    return (
      <PublicIntakeScreen slug={pendingContentLink.slug} onClose={() => consumeContentLink()} />
    );
  }
  if (status === 'unauthenticated') return <LoginScreen />;

  return <AppNavigator />;
}

function ThemedAppShell() {
  const status = useSession((s) => s.status);
  const appearanceQ = useUserAppearance(status === 'authenticated');

  return (
    <MobileThemeProvider settings={status === 'authenticated' ? appearanceQ.data : undefined}>
      <NavigationShell />
    </MobileThemeProvider>
  );
}

function NavigationShell() {
  const theme = useMobileTheme();
  const markNavigationReady = useNavigationReady((s) => s.markReady);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme.navigationTheme}
      onReady={markNavigationReady}
    >
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.statusBarStyle} />
        <NetworkBanner />
        <EmailVerificationBanner />
        <SessionGate />
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ThemedAppShell />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
