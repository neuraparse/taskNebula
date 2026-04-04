'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Clock, Mail, RefreshCcw, Smartphone } from 'lucide-react';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
      const response = await fetch(`/api/notification-preferences?organizationId=${currentOrganizationId}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch preferences' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch preferences');
      }
      return payload as { preferences: Preferences };
    },
    enabled: !!currentOrganizationId,
  });

  useEffect(() => {
    if (!currentOrganizationId) {
      return;
    }

    if (data?.preferences) {
      setPreferences(data.preferences);
      return;
    }

    setPreferences({
      organizationId: currentOrganizationId,
      ...DEFAULTS,
    });
  }, [currentOrganizationId, data]);

  const updatePreferences = useMutation({
    mutationFn: async (nextPreferences: Preferences) => {
      const response = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPreferences),
      });
      const payload = await response.json().catch(() => ({ error: 'Failed to update preferences' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update preferences');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', currentOrganizationId] });
      toast({
        title: 'Preferences saved',
        description: 'Notification settings were updated.',
      });
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
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function resetToDefaults() {
    if (!currentOrganizationId) {
      return;
    }

    setPreferences({
      organizationId: currentOrganizationId,
      ...DEFAULTS,
    });
  }

  if (isLoading || !preferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>Loading notification settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Notification preferences could not be loaded.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Delivery settings
          </CardTitle>
          <CardDescription>Control how activity reaches you across in-app, email, and digest channels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>In-app notifications</Label>
              <p className="text-sm text-muted-foreground">Show updates in the notification bell.</p>
            </div>
            <Switch
              checked={preferences.enableInApp}
              onCheckedChange={(checked) => handleChange('enableInApp', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Email notifications</Label>
              <p className="text-sm text-muted-foreground">Send important updates to your inbox.</p>
            </div>
            <Switch
              checked={preferences.enableEmail}
              onCheckedChange={(checked) => handleChange('enableEmail', checked)}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Digest frequency</Label>
            <Select
              value={preferences.digestFrequency}
              onValueChange={(value) => handleChange('digestFrequency', value as Preferences['digestFrequency'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No digest</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email events
            </CardTitle>
            <CardDescription>Choose which events should trigger email delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {EMAIL_EVENT_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <Label>{field.label}</Label>
                <Switch
                  checked={preferences[field.key]}
                  onCheckedChange={(checked) => handleChange(field.key, checked)}
                  disabled={!preferences.enableEmail}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              In-app events
            </CardTitle>
            <CardDescription>Control what appears in your workspace notification feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {IN_APP_EVENT_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <Label>{field.label}</Label>
                <Switch
                  checked={preferences[field.key]}
                  onCheckedChange={(checked) => handleChange(field.key, checked)}
                  disabled={!preferences.enableInApp}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Do not disturb
          </CardTitle>
          <CardDescription>Pause delivery during quiet hours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable quiet hours</Label>
              <p className="text-sm text-muted-foreground">Mute notifications during the selected time window.</p>
            </div>
            <Switch
              checked={preferences.doNotDisturb}
              onCheckedChange={(checked) => handleChange('doNotDisturb', checked)}
            />
          </div>
          {preferences.doNotDisturb ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={preferences.doNotDisturbStart || '22:00'}
                  onChange={(event) => handleChange('doNotDisturbStart', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type="time"
                  value={preferences.doNotDisturbEnd || '08:00'}
                  onChange={(event) => handleChange('doNotDisturbEnd', event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={resetToDefaults}>
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
