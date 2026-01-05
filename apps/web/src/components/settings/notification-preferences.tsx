'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Clock } from 'lucide-react';
import { useOrganization } from '@/lib/hooks/use-organization';

export function NotificationPreferences() {
  const { currentOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<any>(null);

  // Fetch preferences
  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/notification-preferences?organizationId=${currentOrganizationId}`
      );
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
    enabled: !!currentOrganizationId,
  });

  useEffect(() => {
    if (data?.preferences) {
      setPreferences(data.preferences);
    }
  }, [data]);

  // Update preferences mutation
  const updatePreferences = useMutation({
    mutationFn: async (newPreferences: any) => {
      const response = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganizationId,
          ...newPreferences,
        }),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notification-preferences', currentOrganizationId],
      });
    },
  });

  const handleChange = (field: string, value: boolean | string) => {
    const newPreferences = { ...preferences, [field]: value };
    setPreferences(newPreferences);
  };

  const handleSave = () => {
    updatePreferences.mutate(preferences);
  };

  if (isLoading || !preferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Control how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in the notification bell
              </p>
            </div>
            <Switch
              checked={preferences.enableInApp}
              onCheckedChange={(checked) => handleChange('enableInApp', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={preferences.enableEmail}
              onCheckedChange={(checked) => handleChange('enableEmail', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Digest Frequency</Label>
            <Select
              value={preferences.digestFrequency}
              onValueChange={(value) => handleChange('digestFrequency', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily (9 AM)</SelectItem>
                <SelectItem value="weekly">Weekly (Monday 9 AM)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Receive a summary of activity at regular intervals
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose which events trigger email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>When I&apos;m assigned to an issue</Label>
            <Switch
              checked={preferences.emailOnAssigned}
              onCheckedChange={(checked) => handleChange('emailOnAssigned', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>When I&apos;m mentioned in a comment</Label>
            <Switch
              checked={preferences.emailOnMentioned}
              onCheckedChange={(checked) => handleChange('emailOnMentioned', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>When someone comments on an issue I&apos;m watching</Label>
            <Switch
              checked={preferences.emailOnCommented}
              onCheckedChange={(checked) => handleChange('emailOnCommented', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>When an issue status changes</Label>
            <Switch
              checked={preferences.emailOnStatusChanged}
              onCheckedChange={(checked) => handleChange('emailOnStatusChanged', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>When a new issue is created in a project I&apos;m watching</Label>
            <Switch
              checked={preferences.emailOnIssueCreated}
              onCheckedChange={(checked) => handleChange('emailOnIssueCreated', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>When a sprint starts</Label>
            <Switch
              checked={preferences.emailOnSprintStarted}
              onCheckedChange={(checked) => handleChange('emailOnSprintStarted', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>When a sprint completes</Label>
            <Switch
              checked={preferences.emailOnSprintCompleted}
              onCheckedChange={(checked) => handleChange('emailOnSprintCompleted', checked)}
              disabled={!preferences.enableEmail}
            />
          </div>
        </CardContent>
      </Card>

      {/* Do Not Disturb */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Do Not Disturb
          </CardTitle>
          <CardDescription>
            Pause notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Do Not Disturb</Label>
              <p className="text-sm text-muted-foreground">
                Mute notifications during specified hours
              </p>
            </div>
            <Switch
              checked={preferences.doNotDisturb}
              onCheckedChange={(checked) => handleChange('doNotDisturb', checked)}
            />
          </div>

          {preferences.doNotDisturb && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={preferences.doNotDisturbStart || '22:00'}
                    onChange={(e) => handleChange('doNotDisturbStart', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={preferences.doNotDisturbEnd || '08:00'}
                    onChange={(e) => handleChange('doNotDisturbEnd', e.target.value)}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Notifications will be paused between these hours
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updatePreferences.isPending}
        >
          {updatePreferences.isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}

