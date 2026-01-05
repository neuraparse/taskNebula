'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/hooks/use-organization';
import {
  Building2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'suspended';
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userRole: 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | null;
  isSuperAdmin: boolean;
};

export function OrganizationSettingsClient() {
  const [activeTab, setActiveTab] = useState('general');
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organization details
  const { data: org, isLoading } = useQuery<Organization>({
    queryKey: ['organization', currentOrganizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}`);
      if (!response.ok) throw new Error('Failed to fetch organization');
      return response.json();
    },
    enabled: !!currentOrganizationId,
  });

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  // Update form data when org loads
  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        slug: org.slug || '',
      });
    }
  }, [org]);

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: { name?: string; slug?: string }) => {
      const response = await fetch(`/api/organizations/${currentOrganizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update organization');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Organization updated',
        description: 'Your changes have been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleUpdateGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Organization name is required',
        variant: 'destructive',
      });
      return;
    }
    updateOrgMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Permission checks
  const canManageSettings = org?.userRole === 'owner' || org?.userRole === 'admin' || org?.isSuperAdmin;
  const canDeleteOrg = org?.userRole === 'owner' || org?.isSuperAdmin;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="space-y-8 max-w-[1200px] mx-auto p-8">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  Organization Settings
                </h1>
                <p className="text-muted-foreground mt-2">
                  Manage your organization's basic information and settings
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {org?.userRole?.toUpperCase() || 'MEMBER'}
                </Badge>
                {org?.isSuperAdmin && (
                  <Badge variant="default" className="text-sm bg-purple-600">
                    SUPER ADMIN
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="danger">Danger Zone</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-6">
              <Card className="border-muted-foreground/10">
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                  <CardDescription>
                    Update your organization's basic information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateGeneral} className="space-y-4">
                    {!canManageSettings && (
                      <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          You don't have permission to edit organization settings. Only owners and admins can make changes.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        placeholder="Organization Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={!canManageSettings}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-slug">URL Slug</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">tasknebula.io/</span>
                        <Input
                          id="org-slug"
                          value={formData.slug}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Contact support to change your organization slug
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org-id">Organization ID</Label>
                      <Input
                        id="org-id"
                        value={org?.id || ''}
                        disabled
                        className="bg-muted font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use this ID for API integrations
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Plan</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm">
                            {org?.plan?.toUpperCase() || 'FREE'}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={org?.status === 'active' ? 'default' : org?.status === 'trial' ? 'secondary' : 'destructive'}
                            className="text-sm"
                          >
                            {org?.status?.toUpperCase() || 'TRIAL'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Created</Label>
                      <p className="text-sm text-muted-foreground">
                        {org?.createdAt ? new Date(org.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }) : 'N/A'}
                      </p>
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updateOrgMutation.isPending || !canManageSettings}
                      >
                        {updateOrgMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Danger Zone Tab */}
            <TabsContent value="danger" className="space-y-6">
              {!canDeleteOrg && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    You don't have permission to delete this organization. Only organization owners can perform this action.
                  </p>
                </div>
              )}

              <Card className="border-red-500/50 bg-red-500/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  </div>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20">
                    <div>
                      <p className="font-medium">Delete Organization</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete this organization and all its data
                      </p>
                    </div>
                    <Button variant="destructive" disabled={!canDeleteOrg}>
                      {canDeleteOrg ? 'Delete Organization' : 'Owner Only'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

