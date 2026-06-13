'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  AtSign,
  Bell,
  CheckCircle2,
  Clock,
  FolderPlus,
  Globe2,
  Mail,
  MessageSquare,
  PlusCircle,
  Play,
  Smartphone,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Preferences = {
  userId?: string;
  organizationId: string;
  enableInApp: boolean;
  enableEmail: boolean;
  digestFrequency: 'none' | 'daily' | 'weekly';
  emailOnAssigned: boolean;
  emailOnMentioned: boolean;
  emailOnCommented: boolean;
  emailOnStatusChanged: boolean;
  emailOnIssueCreated: boolean;
  emailOnSprintStarted: boolean;
  emailOnSprintCompleted: boolean;
  emailOnProjectCreated: boolean;
  emailOnProjectArchived: boolean;
  inAppOnAssigned: boolean;
  inAppOnMentioned: boolean;
  inAppOnCommented: boolean;
  inAppOnStatusChanged: boolean;
  inAppOnIssueCreated: boolean;
  inAppOnSprintStarted: boolean;
  inAppOnSprintCompleted: boolean;
  inAppOnProjectCreated: boolean;
  inAppOnProjectArchived: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart: string | null;
  doNotDisturbEnd: string | null;
};

const DEFAULTS: Omit<Preferences, 'organizationId'> = {
  enableInApp: true,
  enableEmail: true,
  digestFrequency: 'none',
  emailOnAssigned: true,
  emailOnMentioned: true,
  emailOnCommented: false,
  emailOnStatusChanged: false,
  emailOnIssueCreated: false,
  emailOnSprintStarted: true,
  emailOnSprintCompleted: true,
  emailOnProjectCreated: false,
  emailOnProjectArchived: false,
  inAppOnAssigned: true,
  inAppOnMentioned: true,
  inAppOnCommented: true,
  inAppOnStatusChanged: true,
  inAppOnIssueCreated: true,
  inAppOnSprintStarted: true,
  inAppOnSprintCompleted: true,
  inAppOnProjectCreated: true,
  inAppOnProjectArchived: true,
  doNotDisturb: false,
  doNotDisturbStart: null,
  doNotDisturbEnd: null,
};

type EmailKey = Extract<keyof Preferences, `emailOn${string}`>;
type InAppKey = Extract<keyof Preferences, `inAppOn${string}`>;

type EventRow = {
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  emailKey: EmailKey;
  inAppKey: InAppKey;
};

type EventGroup = {
  key: string;
  headingKey: string;
  recommended?: boolean;
  rows: ReadonlyArray<EventRow>;
};

const EVENT_GROUPS: ReadonlyArray<EventGroup> = [
  {
    key: 'direct',
    headingKey: 'notifications.group_direct',
    recommended: true,
    rows: [
      {
        labelKey: 'notifications.row_assigned_label',
        descriptionKey: 'notifications.row_assigned_desc',
        icon: UserPlus,
        emailKey: 'emailOnAssigned',
        inAppKey: 'inAppOnAssigned',
      },
      {
        labelKey: 'notifications.row_mentions_label',
        descriptionKey: 'notifications.row_mentions_desc',
        icon: AtSign,
        emailKey: 'emailOnMentioned',
        inAppKey: 'inAppOnMentioned',
      },
    ],
  },
  {
    key: 'activity',
    headingKey: 'notifications.group_activity',
    rows: [
      {
        labelKey: 'notifications.row_comments_label',
        descriptionKey: 'notifications.row_comments_desc',
        icon: MessageSquare,
        emailKey: 'emailOnCommented',
        inAppKey: 'inAppOnCommented',
      },
      {
        labelKey: 'notifications.row_status_label',
        descriptionKey: 'notifications.row_status_desc',
        icon: Activity,
        emailKey: 'emailOnStatusChanged',
        inAppKey: 'inAppOnStatusChanged',
      },
      {
        labelKey: 'notifications.row_new_issues_label',
        descriptionKey: 'notifications.row_new_issues_desc',
        icon: PlusCircle,
        emailKey: 'emailOnIssueCreated',
        inAppKey: 'inAppOnIssueCreated',
      },
    ],
  },
  {
    key: 'sprint',
    headingKey: 'notifications.group_sprint',
    rows: [
      {
        labelKey: 'notifications.row_sprint_start_label',
        descriptionKey: 'notifications.row_sprint_start_desc',
        icon: Play,
        emailKey: 'emailOnSprintStarted',
        inAppKey: 'inAppOnSprintStarted',
      },
      {
        labelKey: 'notifications.row_sprint_complete_label',
        descriptionKey: 'notifications.row_sprint_complete_desc',
        icon: CheckCircle2,
        emailKey: 'emailOnSprintCompleted',
        inAppKey: 'inAppOnSprintCompleted',
      },
    ],
  },
  {
    key: 'lifecycle',
    headingKey: 'notifications.group_lifecycle',
    rows: [
      {
        labelKey: 'notifications.row_new_projects_label',
        descriptionKey: 'notifications.row_new_projects_desc',
        icon: FolderPlus,
        emailKey: 'emailOnProjectCreated',
        inAppKey: 'inAppOnProjectCreated',
      },
      {
        labelKey: 'notifications.row_project_archived_label',
        descriptionKey: 'notifications.row_project_archived_desc',
        icon: Archive,
        emailKey: 'emailOnProjectArchived',
        inAppKey: 'inAppOnProjectArchived',
      },
    ],
  },
];

const WEEKDAYS = [
  { key: 'mon', labelKey: 'notifications.weekday_mon' },
  { key: 'tue', labelKey: 'notifications.weekday_tue' },
  { key: 'wed', labelKey: 'notifications.weekday_wed' },
  { key: 'thu', labelKey: 'notifications.weekday_thu' },
  { key: 'fri', labelKey: 'notifications.weekday_fri' },
  { key: 'sat', labelKey: 'notifications.weekday_sat' },
  { key: 'sun', labelKey: 'notifications.weekday_sun' },
] as const;

type WeekdayKey = (typeof WEEKDAYS)[number]['key'];

const AUTOSAVE_DEBOUNCE_MS = 400;
const SAVED_CHIP_TIMEOUT_MS = 2000;

export function NotificationPreferences() {
  const t = useTranslations('settingsConfig');
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // DND weekdays are UI-only (no backend field yet); local state lets users
  // visualize which days quiet-hours should apply to.
  const [dndDays, setDndDays] = useState<Set<WeekdayKey>>(
    () => new Set(WEEKDAYS.map((d) => d.key))
  );
  const hasHydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['notification-preferences', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/notification-preferences?organizationId=${currentOrganizationId}`
      );
      const payload = await response
        .json()
        .catch(() => ({ error: t('notifications.fetch_failed') }));
      if (!response.ok) {
        throw new Error(payload.error || t('notifications.fetch_failed'));
      }
      return payload as { preferences: Preferences };
    },
    enabled: !!currentOrganizationId,
  });

  useEffect(() => {
    if (!currentOrganizationId) return;
    hasHydratedRef.current = false;
    if (data?.preferences) {
      setPreferences(data.preferences);
      return;
    }
    setPreferences({ organizationId: currentOrganizationId, ...DEFAULTS });
  }, [currentOrganizationId, data]);

  const updatePreferences = useMutation({
    mutationFn: async (nextPreferences: Preferences) => {
      const response = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPreferences),
      });
      const payload = await response
        .json()
        .catch(() => ({ error: t('notifications.update_failed') }));
      if (!response.ok) {
        throw new Error(payload.error || t('notifications.update_failed'));
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notification-preferences', currentOrganizationId],
      });
      setSaveError(null);
      setSavedFlash(true);
      if (savedFlashTimerRef.current) {
        clearTimeout(savedFlashTimerRef.current);
      }
      savedFlashTimerRef.current = setTimeout(() => {
        setSavedFlash(false);
      }, SAVED_CHIP_TIMEOUT_MS);
      toast({
        title: t('notifications.saved_toast_title'),
        description: t('notifications.saved_toast_desc'),
      });
    },
    onError: (mutationError: Error) => {
      setSaveError(mutationError.message);
      setSavedFlash(false);
      toast({
        title: t('notifications.save_failed_title'),
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  // `updatePreferences` from useMutation is a NEW object reference every render,
  // so we can't put it in the effect dep array — that would re-run the effect on
  // every render (including during isPending flips) and trigger a save loop.
  // Keep the latest mutate fn in a ref and depend only on `preferences`.
  const mutateRef = useRef(updatePreferences.mutate);
  useEffect(() => {
    mutateRef.current = updatePreferences.mutate;
  });

  // Debounced auto-save whenever local preferences mutate after hydration.
  useEffect(() => {
    if (!preferences) return;
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    const snapshot = preferences;
    saveTimerRef.current = setTimeout(() => {
      mutateRef.current(snapshot);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [preferences]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    };
  }, []);

  function handleChange<K extends keyof Preferences>(field: K, value: Preferences[K]) {
    setPreferences((current) => {
      if (!current) return current;
      return { ...current, [field]: value };
    });
  }

  function toggleWeekday(key: WeekdayKey) {
    setDndDays((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSaveNow() {
    if (!preferences) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    mutateRef.current(preferences);
  }

  if (isLoading || !preferences) {
    return <NotificationPreferencesSkeleton />;
  }

  if (error) {
    return (
      <div className="panel-danger animate-alert-in text-sm">
        {error instanceof Error ? error.message : t('notifications.load_error')}
      </div>
    );
  }

  const digestNote =
    preferences.digestFrequency === 'daily'
      ? t('notifications.digest_note_daily')
      : preferences.digestFrequency === 'weekly'
        ? t('notifications.digest_note_weekly')
        : null;

  const saveIndicator = updatePreferences.isPending ? (
    <span className="chip-amber inline-flex items-center gap-1.5">
      <span className="status-dot status-warn animate-dot-breathe" />
      {t('notifications.indicator_saving')}
    </span>
  ) : saveError ? (
    <span className="chip-rose animate-alert-in inline-flex items-center gap-1.5">
      <span className="status-dot status-danger" />
      {t('notifications.indicator_save_failed')}
    </span>
  ) : savedFlash ? (
    <span className="chip-emerald inline-flex items-center gap-1.5">
      <span className="status-dot status-live" />
      {t('notifications.indicator_saved')}
    </span>
  ) : (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <span className="status-dot status-muted" />
      {t('notifications.indicator_autosave')}
    </span>
  );

  return (
    <div className="relative space-y-6 pb-24 md:pb-0">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="space-y-2">
          <span className="kicker">{t('notifications.kicker')}</span>
          <h2 className="text-balance bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
            {t('notifications.title')}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">{t('notifications.subtitle')}</p>
        </div>
        <div className="flex min-h-[1.75rem] items-center gap-3 pt-1">{saveIndicator}</div>
      </header>

      {/* Channels card: master toggles */}
      <section
        aria-labelledby="channels-heading"
        className="surface-card animate-fade-up border-border/60 rounded-xl border p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="channels-heading" className="text-base font-semibold tracking-tight">
              {t('notifications.channels_heading')}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">{t('notifications.channels_desc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ChannelMasterCard
            icon={Bell}
            tone="indigo"
            title={t('notifications.channel_inapp_title')}
            description={t('notifications.channel_inapp_desc')}
            checked={preferences.enableInApp}
            onCheckedChange={(checked) => handleChange('enableInApp', checked)}
            ariaLabel={t('notifications.channel_inapp_aria')}
          />
          <ChannelMasterCard
            icon={Mail}
            tone="violet"
            title={t('notifications.channel_email_title')}
            description={t('notifications.channel_email_desc')}
            checked={preferences.enableEmail}
            onCheckedChange={(checked) => handleChange('enableEmail', checked)}
            ariaLabel={t('notifications.channel_email_aria')}
          />
          <ChannelMasterCard
            icon={Smartphone}
            tone="muted"
            title={t('notifications.channel_push_title')}
            description={t('notifications.channel_push_desc')}
            checked={false}
            onCheckedChange={() => {}}
            disabled
            badge={t('notifications.channel_push_badge')}
            ariaLabel={t('notifications.channel_push_aria')}
          />
        </div>
      </section>

      {/* Events card: per-event rows with 3 channel toggles */}
      <section
        aria-labelledby="events-heading"
        className="surface-card animate-fade-up border-border/60 rounded-xl border p-6"
      >
        <div className="mb-6 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 id="events-heading" className="text-base font-semibold tracking-tight">
              {t('notifications.events_heading')}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">{t('notifications.events_desc')}</p>
          </div>
          <div className="hidden md:grid md:w-60 md:grid-cols-3 md:gap-2 md:text-center">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {t('notifications.col_email')}
            </span>
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {t('notifications.col_inapp')}
            </span>
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {t('notifications.col_push')}
            </span>
          </div>
        </div>

        <div className="space-y-8">
          {EVENT_GROUPS.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="kicker">{t(group.headingKey)}</span>
                {group.recommended ? (
                  <span className="chip-emerald">{t('notifications.recommended')}</span>
                ) : null}
              </div>
              <div className="divide-border/60 border-border/60 bg-background/40 divide-y rounded-lg border">
                {group.rows.map((row) => {
                  const Icon = row.icon;
                  const rowLabel = t(row.labelKey);
                  return (
                    <div
                      key={`${group.key}-${row.labelKey}`}
                      className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4"
                    >
                      <div className="flex flex-1 items-start gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-500 ring-1 ring-inset ring-indigo-500/20"
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-sm font-medium leading-tight">{rowLabel}</div>
                          <p className="text-muted-foreground text-xs">{t(row.descriptionKey)}</p>
                        </div>
                      </div>
                      <div className="grid w-full grid-cols-3 gap-2 md:w-60 md:justify-items-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider md:hidden">
                            {t('notifications.col_email')}
                          </span>
                          <Switch
                            checked={preferences[row.emailKey] as boolean}
                            onCheckedChange={(checked) =>
                              handleChange(row.emailKey, checked as never)
                            }
                            disabled={!preferences.enableEmail}
                            aria-label={rowLabel}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider md:hidden">
                            {t('notifications.col_inapp')}
                          </span>
                          <Switch
                            checked={preferences[row.inAppKey] as boolean}
                            onCheckedChange={(checked) =>
                              handleChange(row.inAppKey, checked as never)
                            }
                            disabled={!preferences.enableInApp}
                            aria-label={rowLabel}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider md:hidden">
                            {t('notifications.col_push')}
                          </span>
                          <Switch
                            checked={false}
                            disabled
                            aria-label={t('notifications.push_row_aria', { label: rowLabel })}
                            title={t('notifications.push_coming_soon')}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Email digest */}
      <section
        aria-labelledby="digest-heading"
        className="surface-card animate-fade-up border-border/60 rounded-xl border p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-1">
            <h3 id="digest-heading" className="text-base font-semibold tracking-tight">
              {t('notifications.digest_heading')}
            </h3>
            <p className="text-muted-foreground text-sm">{t('notifications.digest_desc')}</p>
          </div>
          <Select
            value={preferences.digestFrequency}
            onValueChange={(value) =>
              handleChange('digestFrequency', value as Preferences['digestFrequency'])
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('notifications.digest_none')}</SelectItem>
              <SelectItem value="daily">{t('notifications.digest_daily')}</SelectItem>
              <SelectItem value="weekly">{t('notifications.digest_weekly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {digestNote ? <p className="text-muted-foreground mt-4 text-xs">{digestNote}</p> : null}
      </section>

      {/* Do not disturb */}
      <section
        aria-labelledby="dnd-heading"
        className="surface-card animate-fade-up border-border/60 rounded-xl border p-6"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-violet-500 ring-1 ring-inset ring-violet-500/25"
            aria-hidden="true"
          >
            <Clock className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h3 id="dnd-heading" className="text-base font-semibold tracking-tight">
                {t('notifications.dnd_heading')}
              </h3>
              <Switch
                checked={preferences.doNotDisturb}
                onCheckedChange={(checked) => handleChange('doNotDisturb', checked)}
                aria-label={t('notifications.dnd_aria')}
              />
            </div>
            <p className="text-muted-foreground text-sm">{t('notifications.dnd_desc')}</p>
          </div>
        </div>

        {preferences.doNotDisturb ? (
          <div className="border-border/60 mt-6 space-y-5 border-t pt-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1">
                <Label htmlFor="dnd-start" className="text-muted-foreground text-xs">
                  {t('notifications.dnd_from')}
                </Label>
                <Input
                  id="dnd-start"
                  type="time"
                  value={preferences.doNotDisturbStart || '22:00'}
                  onChange={(event) => handleChange('doNotDisturbStart', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dnd-end" className="text-muted-foreground text-xs">
                  {t('notifications.dnd_to')}
                </Label>
                <Input
                  id="dnd-end"
                  type="time"
                  value={preferences.doNotDisturbEnd || '08:00'}
                  onChange={(event) => handleChange('doNotDisturbEnd', event.target.value)}
                />
              </div>
              <div className="border-border/60 bg-muted/30 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate" title={timezone}>
                  {timezone}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">
                {t('notifications.active_days')}
              </Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = dndDays.has(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleWeekday(day.key)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:bg-accent/40 border'
                      )}
                    >
                      {t(day.labelKey)}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {t('notifications.weekday_preview_note')}
              </p>
            </div>

            <p className="text-muted-foreground text-xs">{t('notifications.quiet_hours_note')}</p>
          </div>
        ) : null}
      </section>

      {/* Sticky save button on narrow screens */}
      <div className="fixed bottom-4 right-4 z-30 md:hidden">
        <Button
          type="button"
          onClick={handleSaveNow}
          disabled={updatePreferences.isPending}
          className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg hover:from-indigo-600 hover:to-violet-600"
        >
          {updatePreferences.isPending
            ? t('notifications.working')
            : t('notifications.save_changes')}
        </Button>
      </div>
    </div>
  );
}

type ChannelTone = 'indigo' | 'violet' | 'muted';

function ChannelMasterCard({
  icon: Icon,
  tone,
  title,
  description,
  checked,
  onCheckedChange,
  ariaLabel,
  disabled,
  badge,
}: {
  icon: LucideIcon;
  tone: ChannelTone;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  badge?: string;
}) {
  const toneClasses =
    tone === 'indigo'
      ? 'from-indigo-500/15 to-indigo-500/5 text-indigo-500 ring-indigo-500/25'
      : tone === 'violet'
        ? 'from-violet-500/15 to-violet-500/5 text-violet-500 ring-violet-500/25'
        : 'from-muted/50 to-muted/20 text-muted-foreground ring-border';

  return (
    <div
      className={cn(
        'border-border/60 bg-background/40 flex items-start gap-3 rounded-lg border p-4 transition-colors',
        disabled ? 'opacity-70' : 'hover:bg-background/70'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-inset',
          toneClasses
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{title}</Label>
            {badge ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                {badge}
              </span>
            ) : null}
          </div>
          <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            aria-label={ariaLabel}
          />
        </div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

function NotificationPreferencesSkeleton() {
  const t = useTranslations('settingsConfig');
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <p className="sr-only">{t('notifications.skeleton_loading')}</p>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="surface-card border-border/60 rounded-xl border p-6">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-border/60 flex items-center gap-3 rounded-lg border p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="surface-card border-border/60 rounded-xl border p-6">
        <Skeleton className="mb-4 h-4 w-20" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <div className="border-border/60 rounded-lg border">
                {Array.from({ length: 2 }).map((_, r) => (
                  <div
                    key={r}
                    className="border-border/60 flex items-center gap-4 border-b p-4 last:border-0"
                  >
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-9 rounded-full" />
                      <Skeleton className="h-5 w-9 rounded-full" />
                      <Skeleton className="h-5 w-9 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="surface-card border-border/60 rounded-xl border p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-48" />
      </div>
    </div>
  );
}
