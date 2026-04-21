'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Clock, Mail } from 'lucide-react';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
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
  inAppOnAssigned: boolean;
  inAppOnMentioned: boolean;
  inAppOnCommented: boolean;
  inAppOnStatusChanged: boolean;
  inAppOnIssueCreated: boolean;
  inAppOnSprintStarted: boolean;
  inAppOnSprintCompleted: boolean;
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
  emailOnSprintStarted: false,
  emailOnSprintCompleted: false,
  inAppOnAssigned: true,
  inAppOnMentioned: true,
  inAppOnCommented: true,
  inAppOnStatusChanged: true,
  inAppOnIssueCreated: true,
  inAppOnSprintStarted: true,
  inAppOnSprintCompleted: true,
  doNotDisturb: false,
  doNotDisturbStart: null,
  doNotDisturbEnd: null,
};

type EventRow<K extends keyof Preferences> = {
  key: K;
  label: string;
  description: string;
};

type EventGroup = {
  heading: string;
  recommended?: boolean;
  email: ReadonlyArray<EventRow<keyof Preferences>>;
  inApp: ReadonlyArray<EventRow<keyof Preferences>>;
};

const EVENT_GROUPS: ReadonlyArray<EventGroup> = [
  {
    heading: 'Direct to you',
    recommended: true,
    email: [
      {
        key: 'emailOnAssigned',
        label: 'Assigned to you',
        description: 'Someone assigns an issue to you.',
      },
      {
        key: 'emailOnMentioned',
        label: 'Mentions',
        description: 'Someone @mentions you in a comment.',
      },
    ],
    inApp: [
      {
        key: 'inAppOnAssigned',
        label: 'Assigned to you',
        description: 'Someone assigns an issue to you.',
      },
      {
        key: 'inAppOnMentioned',
        label: 'Mentions',
        description: 'Someone @mentions you in a comment.',
      },
    ],
  },
  {
    heading: 'Activity you follow',
    email: [
      {
        key: 'emailOnCommented',
        label: 'Comments on watched issues',
        description: 'New comments on issues you watch.',
      },
      {
        key: 'emailOnStatusChanged',
        label: 'Status changes',
        description: 'Status changes on issues you watch.',
      },
      {
        key: 'emailOnIssueCreated',
        label: 'New issues',
        description: 'New issues in projects you watch.',
      },
    ],
    inApp: [
      {
        key: 'inAppOnCommented',
        label: 'Comments on watched issues',
        description: 'New comments on issues you watch.',
      },
      {
        key: 'inAppOnStatusChanged',
        label: 'Status changes',
        description: 'Status changes on issues you watch.',
      },
      {
        key: 'inAppOnIssueCreated',
        label: 'New issues',
        description: 'New issues in projects you watch.',
      },
    ],
  },
  {
    heading: 'Sprint updates',
    email: [
      {
        key: 'emailOnSprintStarted',
        label: 'Sprint starts',
        description: "A sprint you're in starts.",
      },
      {
        key: 'emailOnSprintCompleted',
        label: 'Sprint completes',
        description: "A sprint you're in ends.",
      },
    ],
    inApp: [
      {
        key: 'inAppOnSprintStarted',
        label: 'Sprint starts',
        description: "A sprint you're in starts.",
      },
      {
        key: 'inAppOnSprintCompleted',
        label: 'Sprint completes',
        description: "A sprint you're in ends.",
      },
    ],
  },
];

const AUTOSAVE_DEBOUNCE_MS = 400;
const SAVED_CHIP_TIMEOUT_MS = 2000;

export function NotificationPreferences() {
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasHydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      updatePreferences.mutate(snapshot);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [preferences, updatePreferences]);

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

  if (isLoading || !preferences) {
    return (
      <div className="surface-card rounded-lg p-6">
        <p className="text-sm text-muted-foreground">Loading notification settings...</p>
      </div>
    );
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
  ) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="kicker">Notifications</span>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            How you want to be notified
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Email defaults are quiet. We only send you the essentials unless you turn more on.
          </p>
        </div>
        <div className="pt-1 min-h-[1.75rem]">{saveIndicator}</div>
      </header>

      {/* Master toggles */}
      <section className="surface-card animate-fade-up rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4">
            <div
              className="icon-tile icon-tile-accent-blue shrink-0"
              aria-hidden="true"
            >
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">In-app</Label>
                <Switch
                  checked={preferences.enableInApp}
                  onCheckedChange={(checked) => handleChange('enableInApp', checked)}
                  aria-label="Toggle in-app notifications"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Live updates in the app. Low noise.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div
              className="icon-tile icon-tile-accent-violet shrink-0"
              aria-hidden="true"
            >
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Email</Label>
                <Switch
                  checked={preferences.enableEmail}
                  onCheckedChange={(checked) => handleChange('enableEmail', checked)}
                  aria-label="Toggle email notifications"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Only the events you enable below. Respects Do Not Disturb.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What to email me */}
      <section
        className={`surface-card animate-fade-up rounded-lg p-6 transition-opacity duration-200 ease-smooth ${
          preferences.enableEmail ? '' : 'opacity-60'
        }`}
      >
        <div className="mb-6 space-y-1">
          <h3 className="text-base font-semibold tracking-tight">What to email me</h3>
          <p className="text-sm text-muted-foreground">
            Pick the events worth an inbox ping. Everything else stays in-app.
          </p>
        </div>
        <div className="stagger space-y-8">
          {EVENT_GROUPS.map((group) => (
            <div key={`email-${group.heading}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="kicker">{group.heading}</span>
                {group.recommended ? (
                  <span className="chip-emerald">Recommended</span>
                ) : null}
              </div>
              <div>
                {group.email.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-4 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
                  >
                    <div className="flex-1 space-y-0.5">
                      <Label className="text-sm font-medium">{row.label}</Label>
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    </div>
                    <Switch
                      checked={preferences[row.key] as boolean}
                      onCheckedChange={(checked) => handleChange(row.key, checked as never)}
                      disabled={!preferences.enableEmail}
                      aria-label={row.label}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* In-app alerts */}
      <section
        className={`surface-card animate-fade-up rounded-lg p-6 transition-opacity duration-200 ease-smooth ${
          preferences.enableInApp ? '' : 'opacity-60'
        }`}
      >
        <div className="mb-6 space-y-1">
          <h3 className="text-base font-semibold tracking-tight">In-app alerts</h3>
          <p className="text-sm text-muted-foreground">
            What appears in your notification feed inside the app.
          </p>
        </div>
        <div className="stagger space-y-8">
          {EVENT_GROUPS.map((group) => (
            <div key={`inapp-${group.heading}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="kicker">{group.heading}</span>
                {group.recommended ? (
                  <span className="chip-emerald">Recommended</span>
                ) : null}
              </div>
              <div>
                {group.inApp.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-4 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
                  >
                    <div className="flex-1 space-y-0.5">
                      <Label className="text-sm font-medium">{row.label}</Label>
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    </div>
                    <Switch
                      checked={preferences[row.key] as boolean}
                      onCheckedChange={(checked) => handleChange(row.key, checked as never)}
                      disabled={!preferences.enableInApp}
                      aria-label={row.label}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Digest */}
      <section className="surface-card animate-fade-up rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:items-center">
          <div className="space-y-1">
            <h3 className="text-base font-semibold tracking-tight">Email digest</h3>
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
      <section className="surface-card animate-fade-up rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="icon-tile icon-tile-accent-amber shrink-0" aria-hidden="true">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold tracking-tight">Do not disturb</h3>
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
          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dnd-start" className="text-xs text-muted-foreground">
                  Start
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
                  End
                </Label>
                <Input
                  id="dnd-end"
                  type="time"
                  value={preferences.doNotDisturbEnd || '08:00'}
                  onChange={(event) => handleChange('doNotDisturbEnd', event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              During these hours, we won&apos;t send emails. Supports overnight ranges like
              22:00&ndash;08:00.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
