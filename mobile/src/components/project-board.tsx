import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from '@/components/native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  Kanban,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, SemanticBadge } from '@/components/ui';
import { ISSUE_TONE } from '@/components/issue-list';
import type { Issue, IssueStatusCategory, WorkflowStatus } from '@/api/types';
import { useUpdateIssue } from '@/hooks/queries';
import { buildProjectBoardColumns, sortWorkflowStatuses } from '@/lib/project-board';
import type { AppStackParamList } from '@/navigation/types';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { initials, relativeTime } from '@/lib/format';

function statusColor(status: WorkflowStatus, colors: ThemeColors): string {
  if (status.color && /^#[0-9a-f]{3,8}$/i.test(status.color)) return status.color;
  const categoryDot: Partial<Record<IssueStatusCategory, string>> = {
    backlog: colors.mutedForeground,
    todo: colors.mutedForeground,
    in_progress: colors.accentEmerald,
    in_review: colors.accentViolet,
    done: colors.borderStrong,
    cancelled: colors.accentRose,
  };
  return categoryDot[status.category] ?? colors.mutedForeground;
}

function BoardAction({
  label,
  icon: Icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.cardAction,
        { borderColor: colors.border, backgroundColor: colors.secondary },
        disabled ? styles.cardActionDisabled : null,
      ]}
      className="active:opacity-80"
    >
      <Icon size={13} color={colors.foreground} />
      <Text style={[styles.cardActionText, { color: colors.foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function BoardIssueCard({
  columnIndex,
  issue,
  statuses,
}: {
  columnIndex: number;
  issue: Issue;
  statuses: WorkflowStatus[];
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const updateIssue = useUpdateIssue(issue.id);
  const [error, setError] = useState<string | null>(null);
  const previous = statuses[columnIndex - 1] ?? null;
  const next = statuses[columnIndex + 1] ?? null;
  const updatedAt = relativeTime(issue.updatedAt);
  const assigneeInitials = issue.assignee
    ? initials(issue.assignee.name, issue.assignee.email)
    : null;

  const moveIssue = async (target: WorkflowStatus) => {
    setError(null);
    try {
      await updateIssue.mutateAsync({ statusId: target.id });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('board.updateFailed'));
    }
  };

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
        className="active:opacity-80"
        style={styles.cardPressable}
      >
        <View style={styles.cardMeta}>
          {issue.key ? (
            <Text style={[styles.issueKey, { color: colors.mutedForeground }]} numberOfLines={1}>
              {issue.key}
            </Text>
          ) : null}
          <SemanticBadge label={issue.type} tone={ISSUE_TONE[issue.type]} />
        </View>

        <Text
          className="text-foreground text-sm font-semibold"
          style={styles.issueTitle}
          numberOfLines={3}
        >
          {issue.title}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.cardFooterLeft}>
            {assigneeInitials ? <Avatar initials={assigneeInitials} size={22} /> : null}
            {updatedAt ? (
              <Text style={[styles.updatedAt, { color: colors.mutedForeground }]} numberOfLines={1}>
                {updatedAt}
              </Text>
            ) : null}
          </View>
          {issue.priority ? <SemanticBadge label={t(`priority.${issue.priority}`)} /> : null}
        </View>
      </Pressable>

      {error ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
      ) : null}

      <View style={styles.cardActions}>
        <BoardAction
          label={previous?.name ?? t('board.firstColumn')}
          icon={ArrowLeft}
          disabled={!previous || updateIssue.isPending}
          onPress={() => {
            if (previous) void moveIssue(previous);
          }}
        />
        <BoardAction
          label={next?.name ?? t('board.lastColumn')}
          icon={ArrowRight}
          disabled={!next || updateIssue.isPending}
          onPress={() => {
            if (next) void moveIssue(next);
          }}
        />
      </View>
    </View>
  );
}

function BoardColumn({
  columnIndex,
  issues,
  status,
  statuses,
}: {
  columnIndex: number;
  issues: Issue[];
  status: WorkflowStatus;
  statuses: WorkflowStatus[];
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View style={[styles.column, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.columnHeader}>
        <View style={styles.columnTitle}>
          <CircleDot size={14} color={statusColor(status, colors)} />
          <Text style={[styles.columnTitleText, { color: colors.foreground }]} numberOfLines={1}>
            {status.name}
          </Text>
        </View>
        <SemanticBadge label={t('issues.count', { count: issues.length })} />
      </View>

      {issues.length > 0 ? (
        <View style={styles.columnCards}>
          {issues.map((issue) => (
            <BoardIssueCard
              key={issue.id}
              columnIndex={columnIndex}
              issue={issue}
              statuses={statuses}
            />
          ))}
        </View>
      ) : (
        <View
          style={[styles.emptyColumn, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Text style={[styles.emptyColumnText, { color: colors.mutedForeground }]}>
            {t('board.emptyColumn')}
          </Text>
        </View>
      )}
    </View>
  );
}

export function ProjectBoard({
  issues,
  onOpenWorkflowSettings,
  workflowStatuses = [],
  workflowStatusesError = false,
  workflowStatusesLoading = false,
}: {
  issues: Issue[];
  onOpenWorkflowSettings?: () => void;
  workflowStatuses?: WorkflowStatus[];
  workflowStatusesError?: boolean;
  workflowStatusesLoading?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const statuses = useMemo(() => sortWorkflowStatuses(workflowStatuses), [workflowStatuses]);
  const grouped = useMemo(() => buildProjectBoardColumns(issues, statuses), [issues, statuses]);

  if (workflowStatusesLoading) {
    return (
      <View
        style={[styles.statePanel, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Kanban size={24} color={colors.mutedForeground} />
        <Text style={[styles.stateTitle, { color: colors.mutedForeground }]}>
          {t('board.loadingColumns')}
        </Text>
      </View>
    );
  }

  if (workflowStatusesError) {
    return (
      <View
        style={[styles.statePanel, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Kanban size={24} color={colors.destructive} />
        <Text style={[styles.stateTitle, { color: colors.mutedForeground }]}>
          {t('board.workflowStatusesLoadFailed')}
        </Text>
      </View>
    );
  }

  if (statuses.length === 0) {
    return (
      <View
        style={[styles.statePanel, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Kanban size={24} color={colors.mutedForeground} />
        <Text style={[styles.stateTitle, { color: colors.mutedForeground }]}>
          {t('board.noColumns')}
        </Text>
        {onOpenWorkflowSettings ? (
          <Button
            title={t('board.openWorkflowSettings')}
            icon={Settings}
            variant="secondary"
            onPress={onOpenWorkflowSettings}
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.boardContent}
    >
      {grouped.map((column, index) => (
        <BoardColumn
          key={column.status.id}
          columnIndex={index}
          status={column.status}
          statuses={statuses}
          issues={column.issues}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boardContent: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  column: {
    width: 292,
    minHeight: 360,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 10,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  columnTitle: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnTitleText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  columnCards: {
    gap: 10,
  },
  card: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 10,
  },
  cardPressable: {
    gap: 9,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  issueKey: {
    minWidth: 0,
    flex: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
  },
  issueTitle: {
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardFooterLeft: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updatedAt: {
    minWidth: 0,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardAction: {
    minWidth: 0,
    minHeight: 32,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cardActionDisabled: {
    opacity: 0.45,
  },
  cardActionText: {
    minWidth: 0,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyColumn: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 12,
  },
  emptyColumnText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  statePanel: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginHorizontal: 16,
    padding: 16,
  },
  stateTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
});
