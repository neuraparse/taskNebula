'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  label: string;
  description: string;
  icon: LucideIcon;
  emailKey: EmailKey;
  inAppKey: InAppKey;
};

type EventGroup = {
  heading: string;
  recommended?: boolean;
  rows: ReadonlyArray<EventRow>;
};

const EVENT_GROUPS: ReadonlyArray<EventGroup> = [
  {
    heading: 'Direct to you',
    recommended: true,
    rows: [
      {
        label: 'Assigned to you',
        description: 'Someone assigns an issue to you.',
        icon: UserPlus,
        emailKey: 'emailOnAssigned',
        inAppKey: 'inAppOnAssigned',
      },
      {
        label: 'Mentions',
        description: 'Someone @mentions you in a comment.',
        icon: AtSign,
        emailKey: 'emailOnMentioned',
        inAppKey: 'inAppOnMentioned',
      },
    ],
  },
  {
    heading: 'Activity you follow',
    rows: [
      {
        label: 'Comments on watched issues',
        description: 'New comments on issues you watch.',
        icon: MessageSquare,
        emailKey: 'emailOnCommented',
        inAppKey: 'inAppOnCommented',
      },
      {
        label: 'Status changes',
        description: 'Status changes on issues you watch.',
        icon: Activity,
        emailKey: 'emailOnStatusChanged',
        inAppKey: 'inAppOnStatusChanged',
      },
      {
        label: 'New issues',
        description: 'New issues in projects you watch.',
        icon: PlusCircle,
        emailKey: 'emailOnIssueCreated',
        inAppKey: 'inAppOnIssueCreated',
      },
    ],
  },
  {
    heading: 'Sprint & Project',
    rows: [
      {
        label: 'Sprint starts',
        description: "A sprint you're in starts.",
        icon: Play,
        emailKey: 'emailOnSprintStarted',
        inAppKey: 'inAppOnSprintStarted',
      },
      {
        label: 'Sprint completes',
        description: "A sprint you're in ends.",
        icon: CheckCircle2,
        emailKey: 'emailOnSprintCompleted',
        inAppKey: 'inAppOnSprintCompleted',
      },
    ],
  },
  {
    heading: 'Project lifecycle',
    rows: [
      {
        label: 'New projects in your organization',
        description: 'Someone creates a new project in an organization you belong to.',
        icon: FolderPlus,
        emailKey: 'emailOnProjectCreated',
        inAppKey: 'inAppOnProjectCreated',
      },
      {
        label: 'Project archived',
        description: "A project you're a member of is archived.",
        icon: Archive,
        emailKey: 'emailOnProjectArchived',
        inAppKey: 'inAppOnProjectArchived',
      },
    ],
  },
];

const WEEKDAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

type WeekdayKey = (typeof WEEKDAYS)[number]['key'];

const AUTOSAVE_DEBOUNCE_MS = 400;
const SAVED_CHIP_TIMEOUT_MS = 2000;

export function NotificationPreferences() {
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
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch preferences' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch preferences');
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
        .catch(() => ({ error: 'Failed to update preferences' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update preferences');
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
        title: 'Preferences saved',
        description: 'Your notification settings are up to date.',
      });
    },
    onError: (mutationError: Error) => {
      setSaveError(mutationError.message);
      setSavedFlash(false);
      toast({
        title: 'Failed to save preferences',
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
        {error instanceof Error ? error.message : 'Notification preferences could not be loaded.'}
      </div>
    );
  }

  const digestNote =
    preferences.digestFrequency === 'daily'
      ? "You'll get one summary email each morning around 08:00."
      : preferences.digestFrequency === 'weekly'
        ? "You'll get one summary email each Monday morning."
        : null;

  const saveIndicator = updatePreferences.isPending ? (
    <span className="chip-amber inline-flex items-center gap-1.5">
      <span className="status-dot status-warn animate-dot-breathe" />
      Saving
    </span>
  ) : saveError ? (
    <span className="chip-rose animate-alert-in inline-flex items-center gap-1.5">
      <span className="status-dot status-danger" />
      Couldn&apos;t save
    </span>
  ) : savedFlash ? (
    <span className="chip-emerald inline-flex items-center gap-1.5">
      <span className="status-dot status-live" />
      Saved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="status-dot status-muted" />
      Auto-saves as you change
    </span>
  );

  return (
    <div className="relative space-y-6 pb-24 md:pb-0">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="space-y-2">
          <span className="kicker">Notifications</span>
          <h2 className="text-2xl font-semibold tracking-tight text-balance bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            How you want to be notified
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Email defaults are quiet. We only send you the essentials unless you turn more on.
          </p>
        </div>
        <div className="flex min-h-[1.75rem] items-center gap-3 pt-1">
          {saveIndicator}
        </div>
      </header>

      {/* Channels card: master toggles */}
      <section
        aria-labelledby="channels-heading"
        className="surface-card animate-fade-up rounded-xl border border-border/60 p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 id="channels-heading" className="text-base font-semibold tracking-tight">
              Channels
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn a channel off to silence everything below it.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ChannelMasterCard
            icon={Bell}
            tone="indigo"
            title="In-app"
            description="Live updates in your feed."
            checked={preferences.enableInApp}
            onCheckedChange={(checked) => handleChange('enableInApp', checked)}
            ariaLabel="Toggle in-app notifications"
          />
          <ChannelMasterCard
            icon={Mail}
            tone="violet"
            title="Email"
            description="Only events you enable below."
            checked={preferences.enableEmail}
            onCheckedChange={(checked) => handleChange('enableEmail', checked)}
            ariaLabel="Toggle email notifications"
          />
          <ChannelMasterCard
            icon={Smartphone}
            tone="muted"
            title="Push"
            description="Mobile push alerts."
            checked={false}
            onCheckedChange={() => {}}
            disabled
            badge="Soon"
            ariaLabel="Toggle push notifications"
          />
        </div>
      </section>

      {/* Events card: per-event rows with 3 channel toggles */}
      <section
        aria-labelledby="events-heading"
        className="surface-card animate-fade-up rounded-xl border border-border/60 p-6"
      >
        <div className="mb-6 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 id="events-heading" className="text-base font-semibold tracking-tight">
              Events
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick which events ping which channel.
            </p>
          </div>
          <div className="hidden md:grid md:w-60 md:grid-cols-3 md:gap-2 md:text-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              In-app
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Push
            </span>
          </div>
        </div>

        <div className="space-y-8">
          {EVENT_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="kicker">{group.heading}</span>
                {group.recommended ? (
                  <span className="chip-emerald">Recommended</span>
                ) : null}
              </div>
              <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/40">
                {group.rows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div
                      key={`${group.heading}-${row.label}`}
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
                          <div className="text-sm font-medium leading-tight">{row.label}</div>
                          <p className="text-xs text-muted-foreground">{row.description}</p>
                        </div>
                      </div>
                      <div className="grid w-full grid-cols-3 gap-2 md:w-60 md:justify-items-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:hidden">
                            Email
                          </span>
                          <Switch
                            checked={preferences[row.emailKey] as boolean}
                            onCheckedChange={(checked) =>
                              handleChange(row.emailKey, checked as never)
                            }
                            disabled={!preferences.enableEmail}
                            aria-label={row.label}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:hidden">
                            In-app
                          </span>
                          <Switch
                            checked={preferences[row.inAppKey] as boolean}
                            onCheckedChange={(checked) =>
                              handleChange(row.inAppKey, checked as never)
                            }
                            disabled={!preferences.enableInApp}
                            aria-label={row.label}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:hidden">
                            Push
                          </span>
                          <Switch
                            checked={false}
                            disabled
                            aria-label={`Push: ${row.label} (coming soon)`}
                            title="Push notifications are coming soon."
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
        className="surface-card animate-fade-up rounded-xl border border-border/60 p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-1">
            <h3 id="digest-heading" className="text-base font-semibold tracking-tight">
              Email digest
            </h3>
            <p className="text-sm text-muted-foreground">
              A scheduled summary of activity, on top of per-event emails.
            </p>
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
              <SelectItem value="none">No digest</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {digestNote ? (
          <p className="mt-4 text-xs text-muted-foreground">{digestNote}</p>
        ) : null}
      </section>

      {/* Do not disturb */}
      <section
        aria-labelledby="dnd-heading"
        className="surface-card animate-fade-up rounded-xl border border-border/60 p-6"
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
                Do not disturb
              </h3>
              <Switch
                checked={preferences.doNotDisturb}
                onCheckedChange={(checked) => handleChange('doNotDisturb', checked)}
                aria-label="Toggle do not disturb"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Pause emails during quiet hours.
            </p>
          </div>
        </div>

        {preferences.doNotDisturb ? (
          <div className="mt-6 space-y-5 border-t border-border/60 pt-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1">
                <Label htmlFor="dnd-start" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="dnd-start"
                  type="time"
                  value={preferences.doNotDisturbStart || '22:00'}
                  onChange={(event) => handleChange('doNotDisturbStart', event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dnd-end" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="dnd-end"
                  type="time"
                  value={preferences.doNotDisturbEnd || '08:00'}
                  onChange={(event) => handleChange('doNotDisturbEnd', event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate" title={timezone}>
                  {timezone}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Active days</Label>
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
                          : 'border border-border bg-background text-muted-foreground hover:bg-accent/40'
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Weekday selection is a local preview. Quiet-hour days sync once the backend
                supports it.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              During these hours, we won&apos;t send emails. Supports overnight ranges like
              22:00&ndash;08:00.
            </p>
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
          {updatePreferences.isPending ? 'Working…' : 'Save changes'}
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
        'flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-4 transition-colors',
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
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function NotificationPreferencesSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <p className="sr-only">Loading notification settings...</p>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="surface-card rounded-xl border border-border/60 p-6">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border/60 p-4"
            >
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
      <div className="surface-card rounded-xl border border-border/60 p-6">
        <Skeleton className="mb-4 h-4 w-20" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, g) => (
            <div key={g} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <div className="rounded-lg border border-border/60">
                {Array.from({ length: 2 }).map((_, r) => (
                  <div
                    key={r}
                    className="flex items-center gap-4 border-b border-border/60 p-4 last:border-0"
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
      <div className="surface-card rounded-xl border border-border/60 p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-48" />
      </div>
    </div>
  );
}
