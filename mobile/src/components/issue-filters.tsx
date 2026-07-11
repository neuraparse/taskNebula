import { Pressable, StyleSheet, Text, View } from '@/components/native';
import { SlidersHorizontal, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { IssueFilters } from '@/api/endpoints';
import type { Issue, IssueType } from '@/api/types';
import { IconTile, SemanticBadge, SurfaceRow, TextField } from '@/components/ui';
import { useThemeColors } from '@/design/theme-context';

export type IssueStatusFilter = 'all' | 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type IssueTypeFilter = 'all' | Exclude<IssueType, 'subtask'>;

export interface IssueListFilters {
  query: string;
  status: IssueStatusFilter;
  sprintId: 'all' | 'none' | string;
  type: IssueTypeFilter;
}

export const defaultIssueListFilters: IssueListFilters = {
  query: '',
  status: 'all',
  sprintId: 'all',
  type: 'all',
};

export type IssueRouteFilterParams = Partial<
  Pick<IssueListFilters, 'query' | 'status' | 'sprintId' | 'type'>
>;

export function issueListFiltersFromRouteParams(
  params: IssueRouteFilterParams | undefined,
  base: IssueListFilters = defaultIssueListFilters,
): IssueListFilters {
  return {
    ...base,
    ...(params?.query ? { query: params.query } : {}),
    ...(params?.status ? { status: params.status } : {}),
    ...(params?.sprintId ? { sprintId: params.sprintId } : {}),
    ...(params?.type ? { type: params.type } : {}),
  };
}

export function apiFiltersFromIssueListFilters(filters: IssueListFilters): IssueFilters {
  return {
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.type !== 'all' ? { type: filters.type } : {}),
    ...(filters.sprintId !== 'all' ? { sprintId: filters.sprintId } : {}),
  };
}

const STATUS_FILTERS = ['all', 'backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
const TYPE_FILTERS = ['all', 'task', 'story', 'bug', 'epic'] as const;

function includesText(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLowerCase().includes(query));
}

export function filterIssues(issues: Issue[], filters: IssueListFilters): Issue[] {
  const query = filters.query.trim().toLowerCase();

  return issues.filter((issue) => {
    const matchesStatus = filters.status === 'all' || issue.status?.category === filters.status;
    const matchesType = filters.type === 'all' || issue.type === filters.type;
    const matchesSprint =
      filters.sprintId === 'all' ||
      (filters.sprintId === 'none' ? !issue.sprintId : issue.sprintId === filters.sprintId);
    const matchesQuery =
      !query ||
      includesText(issue.key, query) ||
      includesText(issue.title, query) ||
      includesText(issue.description, query) ||
      (issue.labels ?? []).some((label) => includesText(label, query));

    return matchesStatus && matchesType && matchesSprint && matchesQuery;
  });
}

export function hasActiveIssueFilters(filters: IssueListFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.status !== 'all' ||
    filters.sprintId !== 'all' ||
    filters.type !== 'all'
  );
}

function ChoiceButton<T extends string>({
  label,
  selected,
  value,
  onPress,
}: {
  label: string;
  selected: boolean;
  value: T;
  onPress: (value: T) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(value)}
      style={[
        styles.choiceButton,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.card,
        },
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[
          styles.choiceText,
          { color: selected ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IssueFilterPanel({
  filters,
  onChange,
  onReset,
  totalCount,
  visibleCount,
}: {
  filters: IssueListFilters;
  onChange: (filters: IssueListFilters) => void;
  onReset: () => void;
  totalCount: number;
  visibleCount: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const hasFilters = hasActiveIssueFilters(filters);

  return (
    <SurfaceRow className="gap-3">
      <View style={styles.filterHeader}>
        <View className="flex-row items-center gap-3">
          <IconTile icon={SlidersHorizontal} tone="violet" />
          <View className="gap-1">
            <Text className="text-foreground text-base font-semibold">{t('issues.filters')}</Text>
            <Text className="text-muted-foreground text-sm">
              {t('issues.filteredCount', { shown: visibleCount, total: totalCount })}
            </Text>
          </View>
        </View>
        {hasFilters ? (
          <Pressable
            accessibilityRole="button"
            onPress={onReset}
            style={[
              styles.clearButton,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
            className="active:opacity-80"
          >
            <X size={14} color={colors.primary} />
            <Text style={[styles.clearText, { color: colors.primary }]}>{t('common.clear')}</Text>
          </Pressable>
        ) : (
          <SemanticBadge label={t('common.all')} tone="neutral" />
        )}
      </View>

      <TextField
        value={filters.query}
        onChangeText={(query) => onChange({ ...filters, query })}
        placeholder={t('issues.searchPlaceholder')}
        autoCapitalize="none"
      />

      <View style={styles.filterSection}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t('issues.filterStatus')}
        </Text>
        <View style={styles.choiceGrid}>
          {STATUS_FILTERS.map((status) => (
            <ChoiceButton
              key={status}
              value={status}
              label={status === 'all' ? t('common.all') : t(`statusCategory.${status}`)}
              selected={filters.status === status}
              onPress={(next) => onChange({ ...filters, status: next })}
            />
          ))}
        </View>
      </View>

      <View style={styles.filterSection}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t('issues.filterType')}
        </Text>
        <View style={styles.choiceGrid}>
          {TYPE_FILTERS.map((type) => (
            <ChoiceButton
              key={type}
              value={type}
              label={type === 'all' ? t('common.all') : t(`issueType.${type}`)}
              selected={filters.type === type}
              onPress={(next) => onChange({ ...filters, type: next })}
            />
          ))}
        </View>
      </View>
    </SurfaceRow>
  );
}

const styles = StyleSheet.create({
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  filterSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    minWidth: 86,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
