import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from '@/components/native';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileJson,
  ListFilter,
  Search,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  EmptyState,
  IconTile,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import { useThemeColors } from '@/design/theme-context';
import {
  filterApiDocOperations,
  getApiDocsSpec,
  listApiDocOperations,
  listApiDocTags,
  type ApiDocMethod,
  type ApiDocOperation,
} from '@/lib/api-docs';

function methodTone(
  method: ApiDocMethod,
): 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral' {
  if (method === 'get') return 'blue';
  if (method === 'post') return 'emerald';
  if (method === 'put' || method === 'patch') return 'amber';
  if (method === 'delete') return 'rose';
  if (method === 'options' || method === 'head') return 'violet';
  return 'neutral';
}

function TagPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tagPill,
        selected
          ? { borderColor: colors.primary, backgroundColor: colors.primary }
          : { borderColor: colors.border },
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[
          styles.tagPillText,
          { color: selected ? colors.primaryForeground : colors.mutedForeground },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.detailMetric, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function OperationRow({
  operation,
  expanded,
  onToggle,
}: {
  operation: ApiDocOperation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const Chevron = expanded ? ChevronUp : ChevronDown;
  const responseSummary =
    operation.responses.length > 0
      ? operation.responses.map((response) => response.status).join(', ')
      : t('apiDocs.noResponses');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={[
        styles.operationRow,
        { borderBottomColor: colors.border, backgroundColor: colors.card },
      ]}
      className="active:opacity-80"
    >
      <View style={styles.operationHeader}>
        <SemanticBadge label={operation.method.toUpperCase()} tone={methodTone(operation.method)} />
        <Text
          selectable
          style={[styles.operationPath, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {operation.path}
        </Text>
        <Chevron size={18} color={colors.mutedForeground} />
      </View>

      <Text style={[styles.operationSummary, { color: colors.foreground }]} numberOfLines={2}>
        {operation.summary ?? t('apiDocs.summaryFallback')}
      </Text>
      {operation.description ? (
        <Text
          style={[styles.operationDescription, { color: colors.mutedForeground }]}
          numberOfLines={expanded ? undefined : 2}
        >
          {operation.description}
        </Text>
      ) : (
        <Text style={[styles.operationDescription, { color: colors.mutedForeground }]}>
          {t('apiDocs.descriptionFallback')}
        </Text>
      )}

      <View style={styles.badgeRow}>
        <SemanticBadge
          label={operation.requiresAuth ? t('apiDocs.authRequired') : t('apiDocs.noAuth')}
          tone={operation.requiresAuth ? 'indigo' : 'emerald'}
        />
        {operation.hasRequestBody ? (
          <SemanticBadge
            label={
              operation.requestBodyRequired
                ? t('apiDocs.requestBodyRequired')
                : t('apiDocs.requestBodyOptional')
            }
            tone="amber"
          />
        ) : null}
        {operation.tags.map((tag) => (
          <SemanticBadge key={tag} label={tag} tone="neutral" />
        ))}
      </View>

      {expanded ? (
        <View style={[styles.details, { borderTopColor: colors.border }]}>
          <View style={styles.detailGrid}>
            <DetailMetric
              label={t('apiDocs.parameters')}
              value={
                operation.parameters.length > 0
                  ? t('apiDocs.parameterCount', { count: operation.parameters.length })
                  : t('apiDocs.noParameters')
              }
            />
            <DetailMetric label={t('apiDocs.responses')} value={responseSummary} />
          </View>

          {operation.parameters.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, { color: colors.foreground }]}>
                {t('apiDocs.parameterList')}
              </Text>
              {operation.parameters.map((parameter) => (
                <Text
                  key={`${parameter.in}:${parameter.name}`}
                  style={[styles.detailLine, { color: colors.mutedForeground }]}
                >
                  {t('apiDocs.parameterValue', {
                    location: parameter.in,
                    name: parameter.name,
                    required: parameter.required ? t('apiDocs.required') : t('apiDocs.optional'),
                  })}
                </Text>
              ))}
            </View>
          ) : null}

          {operation.responses.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, { color: colors.foreground }]}>
                {t('apiDocs.responseList')}
              </Text>
              {operation.responses.map((response) => (
                <Text
                  key={response.status}
                  style={[styles.detailLine, { color: colors.mutedForeground }]}
                >
                  {t('apiDocs.responseValue', {
                    status: response.status,
                    description: response.description ?? t('apiDocs.responseDescriptionFallback'),
                  })}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function ApiDocsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedOperationId, setExpandedOperationId] = useState<string | null>(null);
  const spec = useMemo(() => getApiDocsSpec(), []);
  const operations = useMemo(() => listApiDocOperations(spec), [spec]);
  const tags = useMemo(() => listApiDocTags(operations), [operations]);
  const filteredOperations = useMemo(
    () => filterApiDocOperations(operations, query, selectedTag),
    [operations, query, selectedTag],
  );

  return (
    <Screen>
      <ScreenHeader
        kicker={t('apiDocs.kicker')}
        title={t('apiDocs.title')}
        subtitle={t('apiDocs.subtitle')}
        meta={
          <SemanticBadge
            label={t('apiDocs.metaEndpointCount', { count: operations.length })}
            tone="blue"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SurfaceRow className="gap-3">
          <View style={styles.sectionHeader}>
            <IconTile icon={FileJson} tone="blue" />
            <View className="min-w-0 flex-1 gap-1">
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t('apiDocs.overviewTitle')}
              </Text>
              <Text style={[styles.panelSubtitle, { color: colors.mutedForeground }]}>
                {spec.info.description ?? t('apiDocs.overviewFallback')}
              </Text>
            </View>
          </View>
          <View style={styles.overviewGrid}>
            <DetailMetric label={t('apiDocs.openapiVersion')} value={spec.openapi} />
            <DetailMetric label={t('apiDocs.apiVersion')} value={spec.info.version} />
            <DetailMetric
              label={t('apiDocs.pathCount')}
              value={t('apiDocs.pathCountValue', { count: Object.keys(spec.paths).length })}
            />
            <DetailMetric
              label={t('apiDocs.endpointCount')}
              value={t('apiDocs.endpointCountValue', { count: operations.length })}
            />
          </View>
        </SurfaceRow>

        <SurfaceRow className="gap-3">
          <View style={styles.sectionHeader}>
            <IconTile icon={Search} tone="cyan" />
            <View className="min-w-0 flex-1 gap-1">
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t('apiDocs.filterTitle')}
              </Text>
              <Text style={[styles.panelSubtitle, { color: colors.mutedForeground }]}>
                {t('apiDocs.filterSubtitle')}
              </Text>
            </View>
          </View>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('apiDocs.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagList}
          >
            <TagPill
              label={t('apiDocs.allTags')}
              selected={selectedTag === null}
              onPress={() => setSelectedTag(null)}
            />
            {tags.map((tag) => (
              <TagPill
                key={tag}
                label={tag}
                selected={selectedTag === tag}
                onPress={() => setSelectedTag(tag)}
              />
            ))}
          </ScrollView>
        </SurfaceRow>

        <SurfaceRow className="gap-3">
          <View style={styles.sectionHeader}>
            <IconTile icon={ListFilter} tone="indigo" />
            <View className="min-w-0 flex-1 gap-1">
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t('apiDocs.resultsTitle', { count: filteredOperations.length })}
              </Text>
              <Text style={[styles.panelSubtitle, { color: colors.mutedForeground }]}>
                {selectedTag
                  ? t('apiDocs.resultsSubtitleTagged', { tag: selectedTag })
                  : t('apiDocs.resultsSubtitle')}
              </Text>
            </View>
          </View>

          {filteredOperations.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('apiDocs.emptyTitle')}
              description={t('apiDocs.emptyDescription')}
            />
          ) : (
            <View style={[styles.operationList, { borderColor: colors.border }]}>
              {filteredOperations.map((operation) => (
                <OperationRow
                  key={operation.id}
                  operation={operation}
                  expanded={expandedOperationId === operation.id}
                  onToggle={() =>
                    setExpandedOperationId((current) =>
                      current === operation.id ? null : operation.id,
                    )
                  }
                />
              ))}
            </View>
          )}
        </SurfaceRow>

        <SurfaceRow className="gap-3">
          <View style={styles.sectionHeader}>
            <IconTile icon={ShieldCheck} tone="emerald" />
            <View className="min-w-0 flex-1 gap-1">
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {t('apiDocs.authTitle')}
              </Text>
              <Text style={[styles.panelSubtitle, { color: colors.mutedForeground }]}>
                {t('apiDocs.authSubtitle')}
              </Text>
            </View>
          </View>
          <View style={styles.authLegend}>
            <ShieldCheck size={16} color={colors.accentIndigo} />
            <Text style={[styles.authLegendText, { color: colors.mutedForeground }]}>
              {t('apiDocs.authLegendCookie')}
            </Text>
          </View>
          <View style={styles.authLegend}>
            <ShieldOff size={16} color={colors.accentEmerald} />
            <Text style={[styles.authLegendText, { color: colors.mutedForeground }]}>
              {t('apiDocs.authLegendPublic')}
            </Text>
          </View>
        </SurfaceRow>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailMetric: {
    borderRadius: 6,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 130,
    padding: 10,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  tagList: {
    gap: 8,
    paddingRight: 8,
  },
  tagPill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  operationList: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  operationRow: {
    borderBottomWidth: 1,
    gap: 8,
    padding: 12,
  },
  operationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  operationPath: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
  },
  operationSummary: {
    fontSize: 15,
    fontWeight: '700',
  },
  operationDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  details: {
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 12,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailSection: {
    gap: 6,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 17,
  },
  authLegend: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  authLegendText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
