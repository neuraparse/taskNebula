'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Clock, Mail, RefreshCcw, Smartphone } from 'lucide-react';
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
  emailOnCommented: true,
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

const EMAIL_EVENT_FIELDS = [
  { key: 'emailOnAssigned', label: 'Assigned to me' },
  { key: 'emailOnMentioned', label: 'Mentioned in a comment' },
  { key: 'emailOnCommented', label: 'Comments on watched issues' },
  { key: 'emailOnStatusChanged', label: 'Issue status changes' },
  { key: 'emailOnIssueCreated', label: 'New issue in watched projects' },
  { key: 'emailOnSprintStarted', label: 'Sprint starts' },
  { key: 'emailOnSprintCompleted', label: 'Sprint completes' },
] as const;

const IN_APP_EVENT_FIELDS = [
  { key: 'inAppOnAssigned', label: 'Assignments' },
  { key: 'inAppOnMentioned', label: 'Mentions' },
  { key: 'inAppOnCommented', label: 'Comments' },
  { key: 'inAppOnStatusChanged', label: 'Status changes' },
  { key: 'inAppOnIssueCreated', label: 'New issues' },
  { key: 'inAppOnSprintStarted', label: 'Sprint starts' },
  { key: 'inAppOnSprintCompleted', label: 'Sprint completions' },
] as const;

export function NotificationPreferences() {
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<Preferences | null>(null);

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
      toast({ title: 'Preferences saved', description: 'Notification settings were updated.' });
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Failed to save preferences',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  function handleChange<K extends keyof Preferences>(field: K, value: Preferences[K]) {
    setPreferences((current) => {
      if (!current) return current;
      return { ...current, [field]: value };
    });
  }

  function resetToDefaults() {
    if (!currentOrganizationId) return;
    setPreferences({ organizationId: currentOrganizationId, ...DEFAULTS });
  }

  if (isLoading || !preferences) {
    return (
      <div className="surface-card p-6">
        <p className="text-sm text-muted-foreground">Loading notification settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Notification preferences could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-8 stagger">
      {/* Delivery */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Notifications</span>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Delivery
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Control how activity reaches you across in-app, email, and digest channels.
          </p>
        </div>
        <div className="surface-card p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-sm font-medium">In-app notifications</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Show updates in the notification bell.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Switch
                checked={preferences.enableInApp}
                onCheckedChange={(checked) => handleChange('enableInApp', checked)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Email notifications</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Send important updates to your inbox.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Switch
                checked={preferences.enableEmail}
                onCheckedChange={(checked) => handleChange('enableEmail', checked)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Digest frequency</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Bundle activity into a scheduled summary.
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
        </div>
      </section>

      {/* Email events */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Email</span>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email events
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Choose which events trigger email delivery.
          </p>
        </div>
        <div className="surface-card p-5 divide-y divide-border/60">
          {EMAIL_EVENT_FIELDS.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <Label className="text-sm font-normal">{field.label}</Label>
              <Switch
                checked={preferences[field.key]}
                onCheckedChange={(checked) => handleChange(field.key, checked)}
                disabled={!preferences.enableEmail}
              />
            </div>
          ))}
        </div>
      </section>

      {/* In-app events */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">In-app</span>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            In-app events
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Control what appears in your notification feed.
          </p>
        </div>
        <div className="surface-card p-5 divide-y divide-border/60">
          {IN_APP_EVENT_FIELDS.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <Label className="text-sm font-normal">{field.label}</Label>
              <Switch
                checked={preferences[field.key]}
                onCheckedChange={(checked) => handleChange(field.key, checked)}
                disabled={!preferences.enableInApp}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Do Not Disturb */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Schedule</span>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Do not disturb
          </h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Pause delivery during quiet hours.
          </p>
        </div>
        <div className="surface-card p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Enable quiet hours</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Mute notifications during the selected window.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Switch
                checked={preferences.doNotDisturb}
                onCheckedChange={(checked) => handleChange('doNotDisturb', checked)}
              />
            </div>
          </div>
          {preferences.doNotDisturb ? (
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
              <Label className="text-sm font-medium">Window</Label>
              <div className="grid grid-cols-2 gap-3">
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
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={resetToDefaults} size="sm">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Reset to defaults
        </Button>
        <Button
          onClick={() => updatePreferences.mutate(preferences)}
          disabled={updatePreferences.isPending}
        >
          {updatePreferences.isPending ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
