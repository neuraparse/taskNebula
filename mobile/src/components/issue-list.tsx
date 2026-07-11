import { Platform, Pressable, StyleSheet, Text, View } from '@/components/native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { Avatar, SemanticBadge } from '@/components/ui';
import type { Issue, IssuePriority, IssueStatusCategory } from '@/api/types';
import type { AppStackParamList } from '@/navigation/types';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { initials, relativeTime } from '@/lib/format';

export const ISSUE_TONE: Record<Issue['type'], 'violet' | 'emerald' | 'blue' | 'rose' | 'cyan'> = {
  epic: 'violet',
  story: 'emerald',
  task: 'blue',
  bug: 'rose',
  subtask: 'cyan',
};

function priorityRailColor(colors: ThemeColors, priority: IssuePriority): string {
  const priorityRail: Record<IssuePriority, string> = {
    critical: colors.accentRose,
    high: colors.accentAmber,
    medium: colors.accentBlue,
    low: colors.mutedForeground,
    none: colors.borderStrong,
  };
  return priorityRail[priority];
}

function statusDotColor(colors: ThemeColors, category?: IssueStatusCategory): string {
  const statusDot: Record<string, string> = {
    backlog: colors.mutedForeground,
    todo: colors.mutedForeground,
    in_progress: colors.accentEmerald,
    in_review: colors.accentViolet,
    done: colors.borderStrong,
    cancelled: colors.destructive,
  };
  if (!category) return colors.mutedForeground;
  return statusDot[String(category)] ?? colors.mutedForeground;
}

function IssueStatusDot({ issue }: { issue: Issue }) {
  const colors = useThemeColors();
  const color = statusDotColor(colors, issue.status?.category);
  const isLive = issue.status?.category === 'in_progress';

  return (
    <View
      style={[
        styles.statusDot,
        { backgroundColor: color },
        isLive ? [styles.statusDotLive, { shadowColor: colors.accentEmerald }] : null,
      ]}
    />
  );
}

function formatOverflowCount(count: number): string {
  return `+${count}`;
}

function IssueLabels({ labels }: { labels: string[] }) {
  const colors = useThemeColors();
  if (labels.length === 0) return null;

  const visible = labels.slice(0, 2);
  const remaining = labels.length - visible.length;

  return (
    <View style={styles.labels}>
      {visible.map((label) => (
        <View
          key={label}
          style={[styles.labelChip, { borderColor: colors.border, backgroundColor: colors.muted }]}
        >
          <Text style={[styles.labelText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
      {remaining > 0 ? (
        <View
          style={[styles.labelChip, { borderColor: colors.border, backgroundColor: colors.muted }]}
        >
          <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
            {formatOverflowCount(remaining)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function IssueListItem({ issue }: { issue: Issue }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const colors = useThemeColors();
  const priority = issue.priority ?? 'none';
  const updatedAt = relativeTime(issue.updatedAt);
  const assigneeInitials = issue.assignee
    ? initials(issue.assignee.name, issue.assignee.email)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
      className="active:opacity-80"
      style={[styles.issueRow, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      <View
        style={[styles.priorityRail, { backgroundColor: priorityRailColor(colors, priority) }]}
      />
      <View style={styles.issueBody}>
        <View style={styles.issueMeta}>
          <View style={styles.issueMetaLeft}>
            <IssueStatusDot issue={issue} />
            {issue.key ? (
              <Text style={[styles.issueKey, { color: colors.mutedForeground }]} numberOfLines={1}>
                {issue.key}
              </Text>
            ) : null}
          </View>
          {updatedAt ? (
            <Text style={[styles.updatedAt, { color: colors.mutedForeground }]} numberOfLines={1}>
              {updatedAt}
            </Text>
          ) : null}
        </View>

        <Text
          className="text-foreground text-sm font-medium"
          numberOfLines={2}
          style={styles.issueTitle}
        >
          {issue.title}
        </Text>

        <View style={styles.issueFooter}>
          <View style={styles.issueFooterLeft}>
            {assigneeInitials ? <Avatar initials={assigneeInitials} size={20} /> : null}
            <IssueLabels labels={issue.labels ?? []} />
          </View>
          <View style={styles.issueFooterRight}>
            <SemanticBadge label={issue.type} tone={ISSUE_TONE[issue.type]} />
            {issue.status?.name ? <SemanticBadge label={issue.status.name} /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function FeaturedIssueCard({ issue }: { issue: Issue }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('IssueDetail', { id: issue.id })}
      className="active:opacity-80"
      style={[styles.featured, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={styles.featuredHeader}>
        {issue.key ? <SemanticBadge label={issue.key} tone={ISSUE_TONE[issue.type]} /> : null}
        {issue.status?.name ? <SemanticBadge label={issue.status.name} /> : null}
      </View>
      <Text className="text-foreground text-lg font-semibold" numberOfLines={2}>
        {issue.title}
      </Text>
      {issue.description ? (
        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
          {issue.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function IssueSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  featured: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 14,
  },
  featuredHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  issueRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginHorizontal: 16,
  },
  priorityRail: {
    width: 4,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  issueBody: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  issueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  issueMetaLeft: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusDotLive: {
    shadowOpacity: 0.5,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  issueKey: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
  },
  updatedAt: {
    fontSize: 11,
    lineHeight: 16,
  },
  issueTitle: {
    lineHeight: 20,
  },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  issueFooterLeft: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  issueFooterRight: {
    maxWidth: '52%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  labels: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  labelChip: {
    maxWidth: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  labelText: {
    fontSize: 10,
    lineHeight: 14,
  },
  separator: {
    height: 8,
  },
});
