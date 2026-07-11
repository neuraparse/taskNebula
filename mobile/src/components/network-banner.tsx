import { useNetInfo } from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/native';
import { useThemeColors } from '@/design/theme-context';

export function NetworkBanner() {
  const netInfo = useNetInfo();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const offline = netInfo.isConnected === false || netInfo.isInternetReachable === false;

  if (!offline) return null;

  return (
    <View className="border-border bg-surface flex-row items-start gap-3 border-b px-4 py-3">
      <WifiOff size={18} color={colors.warning} />
      <View className="flex-1 gap-0.5">
        <Text className="text-foreground text-sm font-semibold">{t('network.offlineTitle')}</Text>
        <Text className="text-muted-foreground text-xs">{t('network.offlineBody')}</Text>
      </View>
    </View>
  );
}
