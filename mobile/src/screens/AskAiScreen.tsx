import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from '@/components/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BookOpen, Bot, FileText, MessageSquareText, Send, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { AskCitationSource, AskScope } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  TextField,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { useAskTaskNebula, useOrganizations } from '@/hooks/queries';
import type { AppStackParamList } from '@/navigation/types';

const ASK_SCOPES = ['all', 'issues', 'docs'] as const satisfies readonly AskScope[];
type AskAiScreenProps = NativeStackScreenProps<AppStackParamList, 'AskAi'>;
type AskAiStyles = ReturnType<typeof createAskAiStyles>;

function useAskAiTheme(): { colors: ThemeColors; styles: AskAiStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createAskAiStyles(colors), [colors]);
  return { colors, styles };
}

function SourceRow({ onPress, source }: { onPress: () => void; source: AskCitationSource }) {
  const { t } = useTranslation();
  const { colors, styles } = useAskAiTheme();
  const Icon = source.type === 'doc' ? BookOpen : FileText;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.sourceRow}
      className="active:opacity-80"
    >
      <View style={styles.sourceIcon}>
        <Icon size={16} color={source.type === 'doc' ? colors.accentEmerald : colors.accentBlue} />
      </View>
      <View style={styles.sourceBody}>
        <View style={styles.sourceMeta}>
          <SemanticBadge
            label={source.type === 'doc' ? t('askAi.docSource') : t('askAi.issueSource')}
            tone={source.type === 'doc' ? 'emerald' : 'blue'}
          />
          {source.key ? <SemanticBadge label={source.key} tone="neutral" /> : null}
        </View>
        <Text style={styles.sourceTitle} numberOfLines={2}>
          {source.title}
        </Text>
        {source.snippet ? (
          <Text style={styles.sourceSnippet} numberOfLines={3}>
            {source.snippet}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function AskAiScreen({ navigation }: AskAiScreenProps) {
  const { i18n, t } = useTranslation();
  const { colors, styles } = useAskAiTheme();
  const organizationsQ = useOrganizations();
  const ask = useAskTaskNebula();
  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data?.organizations],
  );
  const [organizationId, setOrganizationId] = useState('');
  const [scope, setScope] = useState<AskScope>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (organizationId || organizations.length === 0) return;
    setOrganizationId(organizations[0]?.id ?? '');
  }, [organizationId, organizations]);

  const selectedOrganization = organizations.find((org) => org.id === organizationId) ?? null;
  const answer = ask.data?.answer ?? '';
  const citations = ask.data?.citations ?? [];
  const sources = ask.data?.sources ?? [];
  const usage = ask.data?.usage ?? null;
  const canAsk = query.trim().length > 0 && !!organizationId && !ask.isPending;
  const usageLabel = useMemo(() => {
    if (!usage) return null;
    const formatter = new Intl.NumberFormat(i18n.language);
    return t('askAi.usage', {
      model: usage.model || t('askAi.unknownModel'),
      input: formatter.format(usage.inputTokens),
      output: formatter.format(usage.outputTokens),
    });
  }, [i18n.language, t, usage]);

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed || !organizationId) return;
    await ask.mutateAsync({
      query: trimmed,
      organizationId,
      scope,
    });
  };

  const openSource = (source: AskCitationSource) => {
    if (source.type === 'doc') {
      navigation.navigate('DocumentDetail', { id: source.id });
      return;
    }
    navigation.navigate('IssueDetail', { id: source.id });
  };

  if (organizationsQ.isLoading) return <Loading />;
  if (organizationsQ.isError) {
    return (
      <Screen>
        <ErrorView
          message={
            organizationsQ.error instanceof Error ? organizationsQ.error.message : t('common.retry')
          }
          onRetry={() => void organizationsQ.refetch()}
        />
      </Screen>
    );
  }

  if (organizations.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={Bot}
          title={t('askAi.noOrganizationTitle')}
          description={t('askAi.noOrganizationDescription')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <ScreenHeader
          kicker={t('common.appName')}
          title={t('askAi.title')}
          subtitle={t('askAi.subtitle')}
          meta={
            selectedOrganization ? (
              <SemanticBadge label={selectedOrganization.name} tone="violet" />
            ) : undefined
          }
        />

        <View style={styles.panel}>
          <View style={styles.sectionTitle}>
            <Sparkles size={16} color={colors.foreground} />
            <Text style={styles.sectionTitleText}>{t('askAi.askTitle')}</Text>
          </View>

          <View style={styles.orgList}>
            {organizations.map((organization) => {
              const selected = organization.id === organizationId;
              return (
                <Pressable
                  key={organization.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setOrganizationId(organization.id)}
                  style={[styles.choicePill, selected ? styles.choicePillActive : null]}
                  className="active:opacity-80"
                >
                  <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>
                    {organization.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.scopeRow}>
            {ASK_SCOPES.map((item) => {
              const selected = item === scope;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setScope(item)}
                  style={[styles.scopePill, selected ? styles.choicePillActive : null]}
                  className="active:opacity-80"
                >
                  <Text style={[styles.choiceText, selected ? styles.choiceTextActive : null]}>
                    {t(`askAi.scopes.${item}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={t('askAi.queryLabel')}
            placeholder={t('askAi.queryPlaceholder')}
            value={query}
            onChangeText={setQuery}
            editable={!ask.isPending}
            multiline
            className="min-h-24 py-2"
          />
          <Button
            title={ask.isPending ? t('askAi.asking') : t('askAi.ask')}
            icon={Send}
            loading={ask.isPending}
            disabled={!canAsk}
            onPress={() => void submit()}
          />
          {ask.isError ? (
            <Text style={styles.errorText}>
              {ask.error instanceof Error ? ask.error.message : t('askAi.failed')}
            </Text>
          ) : null}
        </View>

        {answer ? (
          <View style={styles.answerPanel}>
            <View style={styles.sectionTitle}>
              <MessageSquareText size={16} color={colors.foreground} />
              <Text style={styles.sectionTitleText}>{t('askAi.answerTitle')}</Text>
            </View>
            <Text style={styles.answerText}>{answer}</Text>
            {usageLabel ? <Text style={styles.usageText}>{usageLabel}</Text> : null}
          </View>
        ) : null}

        {citations.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <FileText size={16} color={colors.foreground} />
              <Text style={styles.sectionTitleText}>{t('askAi.citationsTitle')}</Text>
            </View>
            <View style={styles.citationList}>
              {citations.map((citation) => (
                <SourceRow
                  key={`${citation.type}-${citation.id}-${citation.occurrence}`}
                  source={citation}
                  onPress={() => openSource(citation)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {sources.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <BookOpen size={16} color={colors.foreground} />
              <Text style={styles.sectionTitleText}>{t('askAi.sourcesTitle')}</Text>
            </View>
            <View style={styles.citationList}>
              {sources.slice(0, 6).map((source) => (
                <SourceRow
                  key={`${source.type}-${source.id}`}
                  source={source}
                  onPress={() => openSource(source)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createAskAiStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 16,
      paddingBottom: 28,
    },
    panel: {
      gap: 12,
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    answerPanel: {
      gap: 10,
      marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 12,
    },
    section: {
      gap: 10,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitleText: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    orgList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    scopeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    choicePill: {
      minHeight: 34,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    scopePill: {
      minHeight: 32,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    choicePillActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    choiceText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    choiceTextActive: {
      color: colors.primary,
    },
    answerText: {
      color: colors.foreground,
      fontSize: 14,
      lineHeight: 21,
    },
    usageText: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    citationList: {
      gap: 8,
    },
    sourceRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 10,
    },
    sourceIcon: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    sourceBody: {
      minWidth: 0,
      flex: 1,
      gap: 4,
    },
    sourceMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    sourceTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    sourceSnippet: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 17,
    },
  });
}
