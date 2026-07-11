import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from '@/components/native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  ChevronRight,
  Clock,
  Inbox as InboxIcon,
  Sparkles,
  User,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  EmptyState,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
} from '@/components/ui';
import {
  useCatchMeUp,
  useInboxPage,
  useLoadInboxPage,
  useMarkInboxRead,
  useMarkNotificationRead,
  useSnoozeInboxNotification,
} from '@/hooks/queries';
import { getBaseUrl } from '@/api/client';
import type {
  CatchMeUpActionItem,
  CatchMeUpDigest,
  InboxActorType,
  InboxFilters,
  InboxNotificationType,
  NotificationItem,
} from '@/api/types';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { isContentDeepLink, parseTaskNebulaDeepLink, type ContentDeepLink } from '@/lib/deep-links';
import { formatLocalizedDateTime, relativeTime } from '@/lib/format';
import { navigateToContentDeepLink } from '@/navigation/root';
import type { AppStackParamList, AppTabParamList } from '@/navigation/types';

type InboxTone = 'cyan' | 'emerald' | 'amber' | 'violet';
type ActorFilter = InboxActorType | 'all';
type TypeFilter = InboxNotificationType | 'all';
type InboxRoute = RouteProp<AppTabParamList, 'Inbox'>;
type InboxStyles = ReturnType<typeof createInboxStyles>;

const ACTOR_ICON: Record<string, LucideIcon> = {
  user: User,
  agent: Bot,
  webhook: Webhook,
  system: Zap,
};

const ACTOR_TONE: Record<string, InboxTone> = {
  user: 'cyan',
  agent: 'violet',
  webhook: 'amber',
  system: 'emerald',
};

const ACTOR_FILTERS: Array<{ value: ActorFilter; labelKey: string; icon: LucideIcon }> = [
  { value: 'all', labelKey: 'actorAll', icon: InboxIcon },
  { value: 'user', labelKey: 'actorPeople', icon: User },
  { value: 'agent', labelKey: 'actorAgents', icon: Bot },
  { value: 'webhook', labelKey: 'actorWebhooks', icon: Webhook },
  { value: 'system', labelKey: 'actorSystem', icon: Zap },
];

const TYPE_FILTERS: Array<{ value: TypeFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'typeAll' },
  { value: 'mention', labelKey: 'typeMention' },
  { value: 'assignment', labelKey: 'typeAssignment' },
  { value: 'comment', labelKey: 'typeComment' },
  { value: 'reaction', labelKey: 'typeReaction' },
  { value: 'status', labelKey: 'typeStatus' },
  { value: 'due', labelKey: 'typeDue' },
];

const SNOOZE_PRESETS = [
  { labelKey: 'snoozeOneHour', offsetMs: 60 * 60 * 1000 },
  { labelKey: 'snoozeFourHours', offsetMs: 4 * 60 * 60 * 1000 },
  { labelKey: 'snoozeTomorrow', offsetMs: 24 * 60 * 60 * 1000 },
  { labelKey: 'snoozeNextWeek', offsetMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

const INBOX_PAGE_SIZE = 30;

function useInboxTheme(): { colors: ThemeColors; styles: InboxStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createInboxStyles(colors), [colors]);

  return { colors, styles };
}

function mergeNotifications(
  firstPage: NotificationItem[],
  extraPages: NotificationItem[],
): NotificationItem[] {
  const seen = new Set<string>();
  const merged: NotificationItem[] = [];
  for (const item of [...firstPage, ...extraPages]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function appendUniqueNotifications(
  current: NotificationItem[],
  incoming: NotificationItem[],
  existing: NotificationItem[],
): NotificationItem[] {
  const seen = new Set([...existing, ...current].map((item) => item.id));
  const next = [...current];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

function actorIcon(item: NotificationItem): LucideIcon {
  return ACTOR_ICON[String(item.actorType ?? '')] ?? Bell;
}

function actorTone(item: NotificationItem): InboxTone {
  return ACTOR_TONE[String(item.actorType ?? '')] ?? 'cyan';
}

function relatedLabel(item: NotificationItem): string | null {
  if (item.issue?.key && item.project?.key) return `${item.project.key} / ${item.issue.key}`;
  if (item.issue?.key) return item.issue.key;
  if (item.project?.key) return item.project.key;
  return null;
}

function isFutureIso(iso?: string | null): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function formatDateTime(iso?: string | null): string {
  return formatLocalizedDateTime(iso, '', { dateStyle: 'medium', timeStyle: 'short' });
}

function catchUpUrgencyTone(urgency: CatchMeUpActionItem['urgency']): 'rose' | 'amber' | 'neutral' {
  if (urgency === 'high') return 'rose';
  if (urgency === 'medium') return 'amber';
  return 'neutral';
}

function catchUpUrgencyLabelKey(urgency: CatchMeUpActionItem['urgency']): string {
  if (urgency === 'high') return 'inbox.catchup.urgency.high';
  if (urgency === 'medium') return 'inbox.catchup.urgency.medium';
  return 'inbox.catchup.urgency.low';
}

function contentDeepLinkFromActionLink(link: string): ContentDeepLink | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  const target = trimmed.startsWith('/')
    ? `${getBaseUrl() ?? 'https://tasknebula.local'}${trimmed}`
    : trimmed;
  const intent = parseTaskNebulaDeepLink(target);
  return isContentDeepLink(intent) ? intent : null;
}

function catchUpSourceLabel(digest: CatchMeUpDigest, t: ReturnType<typeof useTranslation>['t']) {
  if (digest.source === 'native') return t('inbox.catchup.sourceNative');
  return t('inbox.catchup.sourceOther', { source: digest.source });
}

function InboxFilterButton({
  icon: Icon,
  label,
  active,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, styles } = useInboxTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.filterButton, active ? styles.filterButtonActive : null]}
      className="active:opacity-80"
    >
      {Icon ? <Icon size={14} color={active ? colors.primary : colors.mutedForeground} /> : null}
      <Text style={[styles.filterLabel, active ? styles.filterLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function InboxFilterGroup({ children, label }: { children: ReactNode; label: string }) {
  const { styles } = useInboxTheme();

  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <View style={styles.filterRow}>{children}</View>
    </View>
  );
}

function CatchMeUpPanel({
  digest,
  error,
  loading,
  requested,
  onOpenAction,
  onRequest,
}: {
  digest?: CatchMeUpDigest | undefined;
  error: boolean;
  loading: boolean;
  requested: boolean;
  onOpenAction: (action: CatchMeUpActionItem) => void;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useInboxTheme();
  const summaryMarkdown = digest?.summaryMarkdown ?? '';
  const hasSummary = summaryMarkdown.trim().length > 0;

  return (
    <View style={styles.catchUpPanel}>
      <View style={styles.catchUpHeader}>
        <View style={styles.catchUpTitleRow}>
          <IconTile icon={Sparkles} tone="violet" />
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-foreground text-base font-semibold">
              {t('inbox.catchup.title')}
            </Text>
            <Text style={styles.catchUpPrompt}>{t('inbox.catchup.prompt')}</Text>
          </View>
        </View>
        <Button
          title={requested ? t('inbox.catchup.refresh') : t('inbox.catchup.action')}
          icon={Sparkles}
          loading={loading}
          disabled={loading}
          onPress={onRequest}
        />
      </View>

      {loading ? (
        <View style={styles.catchUpStatusRow}>
          <Sparkles size={15} color={colors.accentViolet} />
          <Text style={styles.catchUpPrompt}>{t('inbox.catchup.summarizing')}</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <Text style={styles.catchUpError}>{t('inbox.catchup.loadFailed')}</Text>
      ) : null}

      {!loading && requested && digest && !hasSummary ? (
        <Text style={styles.catchUpPrompt}>{t('inbox.catchup.noSummary')}</Text>
      ) : null}

      {hasSummary ? (
        <View style={styles.catchUpSummaryBox}>
          <Text selectable style={styles.catchUpSummaryText}>
            {summaryMarkdown}
          </Text>
        </View>
      ) : null}

      {digest && digest.actionItems.length > 0 ? (
        <View style={styles.catchUpActions}>
          <Text style={styles.catchUpSectionLabel}>{t('inbox.catchup.suggestedNextSteps')}</Text>
          {digest.actionItems.map((action, index) => {
            const intent = contentDeepLinkFromActionLink(action.link);
            const row = (
              <>
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.catchUpActionTitle} numberOfLines={2}>
                    {action.title}
                  </Text>
                  <Text style={styles.catchUpActionLink} numberOfLines={1}>
                    {action.link}
                  </Text>
                </View>
                <SemanticBadge
                  label={t(catchUpUrgencyLabelKey(action.urgency))}
                  tone={catchUpUrgencyTone(action.urgency)}
                />
                {intent ? <ArrowRight size={15} color={colors.mutedForeground} /> : null}
              </>
            );

            return intent ? (
              <Pressable
                key={`${action.link}-${index}`}
                accessibilityRole="button"
                onPress={() => onOpenAction(action)}
                style={styles.catchUpActionRow}
                className="active:opacity-80"
              >
                {row}
              </Pressable>
            ) : (
              <View key={`${action.link}-${index}`} style={styles.catchUpActionRow}>
                {row}
              </View>
            );
          })}
        </View>
      ) : null}

      {digest ? <Text style={styles.catchUpSource}>{catchUpSourceLabel(digest, t)}</Text> : null}
    </View>
  );
}

function NotificationRow({
  item,
  markingRead,
  snoozing,
  onMarkRead,
  onSnooze,
}: {
  item: NotificationItem;
  markingRead: boolean;
  snoozing: boolean;
  onMarkRead: (id: string) => void;
  onSnooze: (id: string, until: string | null) => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useInboxTheme();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const unread = !(item.isRead ?? item.read ?? false);
  const Icon = actorIcon(item);
  const tone = actorTone(item);
  const time = relativeTime(item.createdAt);
  const isSnoozed = isFutureIso(item.snoozedUntil);
  const snoozed = isSnoozed ? formatDateTime(item.snoozedUntil) : '';
  const related = relatedLabel(item);
  const title = item.title ?? item.type;
  const issueId = item.issueId ?? item.issue?.id;
  const projectId = item.projectId ?? item.project?.id;
  const linkedIntent = item.link ? contentDeepLinkFromActionLink(item.link) : null;
  const canOpenRelated = Boolean(linkedIntent ?? issueId ?? projectId);

  const openRelated = () => {
    if (unread) onMarkRead(item.id);
    if (linkedIntent) {
      navigateToContentDeepLink(linkedIntent);
      return;
    }
    if (issueId) {
      navigation.navigate('IssueDetail', { id: issueId });
      return;
    }
    if (projectId) {
      navigation.navigate('ProjectDetail', { id: projectId });
    }
  };

  return (
    <View style={[styles.notificationRow, unread ? styles.notificationUnread : null]}>
      <View style={[styles.unreadRail, unread ? styles.unreadRailActive : null]} />
      <View style={styles.rowContent}>
        <Pressable
          accessibilityRole={canOpenRelated ? 'button' : undefined}
          disabled={!canOpenRelated}
          onPress={openRelated}
          style={styles.rowOpenTarget}
          className="active:opacity-80"
        >
          <IconTile icon={Icon} tone={tone} />
          <View style={styles.rowBody}>
            <View style={styles.rowMeta}>
              <View style={styles.metaLeft}>
                {item.actorType ? (
                  <SemanticBadge label={String(item.actorType)} tone={tone} />
                ) : null}
                {related ? <SemanticBadge label={related} tone="neutral" /> : null}
                {snoozed ? (
                  <SemanticBadge label={t('inbox.snoozedUntil', { date: snoozed })} tone="amber" />
                ) : null}
              </View>
              <View style={styles.metaRight}>
                {time ? (
                  <Text style={styles.timeText} numberOfLines={1}>
                    {time}
                  </Text>
                ) : null}
                {canOpenRelated ? <ChevronRight size={16} color={colors.mutedForeground} /> : null}
              </View>
            </View>

            <Text className="text-foreground text-base font-semibold" numberOfLines={2}>
              {title}
            </Text>
            {item.message ? (
              <Text
                className="text-muted-foreground text-sm"
                numberOfLines={2}
                style={styles.message}
              >
                {item.message}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.rowActions}>
          {unread ? (
            <Pressable
              accessibilityRole="button"
              disabled={markingRead}
              onPress={() => onMarkRead(item.id)}
              style={[styles.inlineAction, markingRead ? styles.inlineActionDisabled : null]}
              className="active:opacity-80"
            >
              <Check size={14} color={colors.primary} />
              <Text style={styles.inlineActionText}>{t('inbox.markRead')}</Text>
            </Pressable>
          ) : (
            <SemanticBadge label={t('inbox.read')} tone="neutral" />
          )}
          {canOpenRelated ? (
            <Pressable
              accessibilityRole="button"
              onPress={openRelated}
              style={styles.inlineAction}
              className="active:opacity-80"
            >
              <ChevronRight size={14} color={colors.primary} />
              <Text style={styles.inlineActionText}>{t('inbox.openRelated')}</Text>
            </Pressable>
          ) : null}
          {isSnoozed ? (
            <Pressable
              accessibilityRole="button"
              disabled={snoozing}
              onPress={() => onSnooze(item.id, null)}
              style={[styles.inlineAction, snoozing ? styles.inlineActionDisabled : null]}
              className="active:opacity-80"
            >
              <Clock size={14} color={colors.primary} />
              <Text style={styles.inlineActionText}>{t('inbox.unsnooze')}</Text>
            </Pressable>
          ) : (
            SNOOZE_PRESETS.map((preset) => {
              const until = new Date(Date.now() + preset.offsetMs).toISOString();
              return (
                <Pressable
                  key={preset.labelKey}
                  accessibilityRole="button"
                  disabled={snoozing}
                  onPress={() => onSnooze(item.id, until)}
                  style={[styles.inlineAction, snoozing ? styles.inlineActionDisabled : null]}
                  className="active:opacity-80"
                >
                  <Clock size={14} color={colors.primary} />
                  <Text style={styles.inlineActionText}>{t(`inbox.${preset.labelKey}`)}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

function InboxListHeader({
  actorFilter,
  catchUpDigest,
  catchUpError,
  catchUpLoading,
  catchUpRequested,
  count,
  hasUnread,
  markAllLoading,
  onCatchUpRequest,
  onOpenCatchUpAction,
  onMarkAllRead,
  onActorFilterChange,
  onTypeFilterChange,
  setSnoozedOnly,
  unreadOnly,
  setUnreadOnly,
  snoozedOnly,
  typeFilter,
}: {
  actorFilter: ActorFilter;
  catchUpDigest?: CatchMeUpDigest | undefined;
  catchUpError: boolean;
  catchUpLoading: boolean;
  catchUpRequested: boolean;
  count: number;
  hasUnread: boolean;
  markAllLoading: boolean;
  onCatchUpRequest: () => void;
  onOpenCatchUpAction: (action: CatchMeUpActionItem) => void;
  onMarkAllRead: () => void;
  onActorFilterChange: (value: ActorFilter) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  setSnoozedOnly: (value: boolean) => void;
  unreadOnly: boolean;
  setUnreadOnly: (value: boolean) => void;
  snoozedOnly: boolean;
  typeFilter: TypeFilter;
}) {
  const { t } = useTranslation();
  const { styles } = useInboxTheme();

  return (
    <View>
      <ScreenHeader
        kicker={t('common.appName')}
        title={t('inbox.title')}
        subtitle={t('inbox.subtitle')}
        meta={<SemanticBadge label={t('inbox.count', { count })} tone="cyan" />}
      />
      <View style={styles.filters}>
        <CatchMeUpPanel
          digest={catchUpDigest}
          error={catchUpError}
          loading={catchUpLoading}
          requested={catchUpRequested}
          onOpenAction={onOpenCatchUpAction}
          onRequest={onCatchUpRequest}
        />

        <InboxFilterGroup label={t('inbox.filterActors')}>
          {ACTOR_FILTERS.map((filter) => (
            <InboxFilterButton
              key={filter.value}
              icon={filter.icon}
              label={t(`inbox.${filter.labelKey}`)}
              active={actorFilter === filter.value}
              onPress={() => onActorFilterChange(filter.value)}
            />
          ))}
        </InboxFilterGroup>

        <InboxFilterGroup label={t('inbox.filterTypes')}>
          {TYPE_FILTERS.map((filter) => (
            <InboxFilterButton
              key={filter.value}
              label={t(`inbox.${filter.labelKey}`)}
              active={typeFilter === filter.value}
              onPress={() => onTypeFilterChange(filter.value)}
            />
          ))}
        </InboxFilterGroup>

        <InboxFilterGroup label={t('inbox.filterStatus')}>
          <InboxFilterButton
            icon={InboxIcon}
            label={t('inbox.all')}
            active={!unreadOnly && !snoozedOnly}
            onPress={() => {
              setUnreadOnly(false);
              setSnoozedOnly(false);
            }}
          />
          <InboxFilterButton
            icon={Bell}
            label={t('inbox.unread')}
            active={unreadOnly}
            onPress={() => setUnreadOnly(!unreadOnly)}
          />
          <InboxFilterButton
            icon={Clock}
            label={t('inbox.snoozed')}
            active={snoozedOnly}
            onPress={() => setSnoozedOnly(!snoozedOnly)}
          />
          <View style={styles.filterSpacer} />
          <Button
            title={t('inbox.markAllRead')}
            variant="secondary"
            icon={Check}
            loading={markAllLoading}
            disabled={!hasUnread || markAllLoading}
            onPress={onMarkAllRead}
          />
        </InboxFilterGroup>
      </View>
    </View>
  );
}

function InboxEmptyState() {
  const { t } = useTranslation();

  return <EmptyState icon={Bell} title={t('inbox.empty')} description={t('inbox.emptyDesc')} />;
}

export function InboxScreen() {
  const { t } = useTranslation();
  const { styles } = useInboxTheme();
  const route = useRoute<InboxRoute>();
  const routeParams = route.params;
  const [actorFilter, setActorFilter] = useState<ActorFilter>(routeParams?.actorFilter ?? 'all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(routeParams?.typeFilter ?? 'all');
  const [unreadOnly, setUnreadOnly] = useState(routeParams?.unreadOnly === true);
  const [snoozedOnly, setSnoozedOnly] = useState(routeParams?.snoozedOnly === true);
  const [catchUpRequested, setCatchUpRequested] = useState(false);
  const [extraNotifications, setExtraNotifications] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const filters = useMemo<InboxFilters>(
    () => ({
      ...(actorFilter !== 'all' ? { actorType: actorFilter } : {}),
      ...(typeFilter !== 'all' ? { notificationType: typeFilter } : {}),
      ...(unreadOnly ? { unreadOnly: true } : {}),
      ...(snoozedOnly ? { snoozed: true } : {}),
    }),
    [actorFilter, snoozedOnly, typeFilter, unreadOnly],
  );
  const pageFilters = useMemo<InboxFilters>(
    () => ({
      ...filters,
      limit: INBOX_PAGE_SIZE,
    }),
    [filters],
  );
  const filterKey = useMemo(() => JSON.stringify(pageFilters), [pageFilters]);
  const { data, isLoading, isError, error, refetch, isRefetching } = useInboxPage(pageFilters);
  const loadInboxPage = useLoadInboxPage();
  const markNotificationRead = useMarkNotificationRead();
  const markInboxRead = useMarkInboxRead();
  const snoozeInbox = useSnoozeInboxNotification();
  const catchMeUpQ = useCatchMeUp(null, false);
  const firstPageNotifications = useMemo(() => data?.items ?? [], [data?.items]);
  const notifications = useMemo(
    () => mergeNotifications(firstPageNotifications, extraNotifications),
    [extraNotifications, firstPageNotifications],
  );
  const hasUnread = notifications.some((item) => !(item.isRead ?? item.read ?? false));
  const canLoadMore = Boolean(nextCursor);

  useEffect(() => {
    setActorFilter(routeParams?.actorFilter ?? 'all');
    setTypeFilter(routeParams?.typeFilter ?? 'all');
    setUnreadOnly(routeParams?.unreadOnly === true);
    setSnoozedOnly(routeParams?.snoozedOnly === true);
  }, [
    routeParams?.actorFilter,
    routeParams?.snoozedOnly,
    routeParams?.typeFilter,
    routeParams?.unreadOnly,
  ]);

  useEffect(() => {
    setExtraNotifications([]);
    setNextCursor(null);
    setLoadMoreFailed(false);
  }, [filterKey]);

  useEffect(() => {
    if (!data || extraNotifications.length > 0) return;
    setNextCursor(data.nextCursor);
  }, [data, extraNotifications.length]);

  const refreshInbox = () => {
    setExtraNotifications([]);
    setNextCursor(null);
    setLoadMoreFailed(false);
    void refetch().then((result) => {
      setNextCursor(result.data?.nextCursor ?? null);
    });
  };

  const resetLoadedPages = () => {
    setExtraNotifications([]);
    setNextCursor(data?.nextCursor ?? null);
    setLoadMoreFailed(false);
  };

  const loadMore = async () => {
    if (!nextCursor || loadInboxPage.isPending) return;
    setLoadMoreFailed(false);
    try {
      const page = await loadInboxPage.mutateAsync({ ...pageFilters, cursor: nextCursor });
      setExtraNotifications((current) =>
        appendUniqueNotifications(current, page.items, firstPageNotifications),
      );
      setNextCursor(page.nextCursor);
    } catch {
      setLoadMoreFailed(true);
    }
  };

  const requestCatchUp = () => {
    setCatchUpRequested(true);
    void catchMeUpQ.refetch();
  };

  const openCatchUpAction = (action: CatchMeUpActionItem) => {
    const intent = contentDeepLinkFromActionLink(action.link);
    if (intent) navigateToContentDeepLink(intent);
  };

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Screen>
        <ErrorView
          message={error instanceof Error ? error.message : t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const renderItem: ListRenderItem<NotificationItem> = ({ item }) => (
    <NotificationRow
      item={item}
      markingRead={markNotificationRead.isPending && markNotificationRead.variables === item.id}
      snoozing={snoozeInbox.isPending && snoozeInbox.variables?.notificationId === item.id}
      onMarkRead={(id) => void markNotificationRead.mutate(id, { onSuccess: resetLoadedPages })}
      onSnooze={(id, until) =>
        void snoozeInbox.mutate({ notificationId: id, until }, { onSuccess: resetLoadedPages })
      }
    />
  );

  return (
    <Screen>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={InboxSeparator}
        ListHeaderComponent={
          <InboxListHeader
            actorFilter={actorFilter}
            catchUpDigest={catchMeUpQ.data}
            catchUpError={catchMeUpQ.isError}
            catchUpLoading={catchMeUpQ.isFetching}
            catchUpRequested={catchUpRequested}
            count={notifications.length}
            hasUnread={hasUnread}
            markAllLoading={markInboxRead.isPending}
            onCatchUpRequest={requestCatchUp}
            onOpenCatchUpAction={openCatchUpAction}
            onMarkAllRead={() => {
              resetLoadedPages();
              void markInboxRead.mutate();
            }}
            onActorFilterChange={setActorFilter}
            onTypeFilterChange={setTypeFilter}
            setSnoozedOnly={setSnoozedOnly}
            unreadOnly={unreadOnly}
            setUnreadOnly={setUnreadOnly}
            snoozedOnly={snoozedOnly}
            typeFilter={typeFilter}
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshInbox} />}
        ListEmptyComponent={<InboxEmptyState />}
        ListFooterComponent={
          canLoadMore || loadMoreFailed ? (
            <View style={styles.loadMoreFooter}>
              {loadMoreFailed ? (
                <Text style={styles.loadMoreError}>{t('inbox.loadMoreFailed')}</Text>
              ) : null}
              {canLoadMore ? (
                <Button
                  title={loadInboxPage.isPending ? t('inbox.loadingMore') : t('inbox.loadMore')}
                  variant="secondary"
                  icon={ArrowRight}
                  loading={loadInboxPage.isPending}
                  disabled={loadInboxPage.isPending}
                  onPress={() => void loadMore()}
                />
              ) : null}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function InboxSeparator() {
  const { styles } = useInboxTheme();

  return <View style={styles.separator} />;
}

function createInboxStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 16,
    },
    filters: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    filterGroup: {
      gap: 7,
    },
    filterGroupLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      textTransform: 'uppercase',
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    catchUpPanel: {
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.accentViolet}55`,
      borderRadius: 6,
      backgroundColor: colors.card,
      padding: 12,
    },
    catchUpHeader: {
      gap: 12,
    },
    catchUpTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    catchUpPrompt: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
    catchUpStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    catchUpError: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 17,
    },
    catchUpSummaryBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    catchUpSummaryText: {
      color: colors.foreground,
      fontSize: 12,
      lineHeight: 18,
    },
    catchUpActions: {
      gap: 8,
    },
    catchUpSectionLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      textTransform: 'uppercase',
    },
    catchUpActionRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    catchUpActionTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    catchUpActionLink: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    catchUpSource: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 15,
    },
    filterSpacer: {
      flex: 1,
    },
    filterButton: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    filterButtonActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}1A`,
    },
    filterLabel: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    filterLabelActive: {
      color: colors.primary,
    },
    notificationRow: {
      flexDirection: 'row',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      marginHorizontal: 16,
    },
    notificationUnread: {
      backgroundColor: colors.surface,
    },
    unreadRail: {
      width: 4,
      backgroundColor: 'transparent',
    },
    unreadRailActive: {
      backgroundColor: colors.accentCyan,
    },
    rowContent: {
      minWidth: 0,
      flex: 1,
      gap: 10,
      padding: 12,
    },
    rowOpenTarget: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    rowBody: {
      minWidth: 0,
      flex: 1,
      gap: 6,
    },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    metaRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaLeft: {
      minWidth: 0,
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    timeText: {
      color: colors.mutedForeground,
      fontSize: 11,
      lineHeight: 16,
    },
    message: {
      lineHeight: 20,
    },
    rowActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingLeft: 52,
    },
    inlineAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    inlineActionDisabled: {
      opacity: 0.55,
    },
    inlineActionText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    loadMoreFooter: {
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    loadMoreError: {
      color: colors.destructive,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
    },
    separator: {
      height: 8,
    },
  });
}
