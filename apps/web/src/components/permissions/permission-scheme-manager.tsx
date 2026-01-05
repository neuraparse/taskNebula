'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Shield, Copy, Trash2, Edit, Check, Star } from 'lucide-react';

interface PermissionScheme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: Record<string, string[]>;
  createdAt: string;
  projectCount?: number;
}

interface PermissionSchemeManagerProps {
  organizationId: string;
}

const PROJECT_ROLES = [
  { value: 'product_owner', label: 'Product Owner' },
  { value: 'scrum_master', label: 'Scrum Master' },
  { value: 'tech_lead', label: 'Tech Lead' },
  { value: 'developer', label: 'Developer' },
  { value: 'qa_engineer', label: 'QA Engineer' },
  { value: 'designer', label: 'Designer' },
  { value: 'viewer', label: 'Viewer' },
];

export function PermissionSchemeManager({ organizationId }: PermissionSchemeManagerProps) {
  const [schemes, setSchemes] = useState<PermissionScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newScheme, setNewScheme] = useState({ name: '', description: '', baseRole: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchSchemes();
  }, [organizationId]);

  const fetchSchemes = async () => {
    try {
      const res = await fetch(`/api/permission-schemes?organizationId=${organizationId}`);
      if (res.ok) {
        const data = await res.json();
        setSchemes(data);
      }
    } catch (error) {
      console.error('Error fetching schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createScheme = async () => {
    try {
      const res = await fetch('/api/permission-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name: newScheme.name,
          description: newScheme.description,
          baseRole: newScheme.baseRole || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Permission scheme created successfully' });
        setCreateDialogOpen(false);
        setNewScheme({ name: '', description: '', baseRole: '' });
        fetchSchemes();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create scheme', variant: 'destructive' });
    }
  };

  const setAsDefault = async (schemeId: string) => {
    try {
      const res = await fetch(`/api/permission-schemes/${schemeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Default scheme updated' });
        fetchSchemes();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update scheme', variant: 'destructive' });
    }
  };

  const deleteScheme = async (schemeId: string) => {
    try {
      const res = await fetch(`/api/permission-schemes/${schemeId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Success', description: 'Scheme deleted' });
        fetchSchemes();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete scheme', variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="p-4">Loading permission schemes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Permission Schemes</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable permission templates for your projects
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Scheme</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Permission Scheme</DialogTitle>
              <DialogDescription>Create a new reusable permission template</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newScheme.name} onChange={(e) => setNewScheme({ ...newScheme, name: e.target.value })} placeholder="e.g., Standard Project Permissions" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newScheme.description} onChange={(e) => setNewScheme({ ...newScheme, description: e.target.value })} placeholder="Describe this permission scheme..." />
              </div>
              <div className="space-y-2">
                <Label>Base Role (Optional)</Label>
                <Select value={newScheme.baseRole} onValueChange={(v) => setNewScheme({ ...newScheme, baseRole: v })}>
                  <SelectTrigger><SelectValue placeholder="Start from a role template" /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={createScheme} disabled={!newScheme.name}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schemes.map((scheme) => (
          <Card key={scheme.id} className={scheme.isDefault ? 'border-primary' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{scheme.name}</CardTitle>
                </div>
                {scheme.isDefault && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> Default
                  </Badge>
                )}
              </div>
              {scheme.description && (
                <CardDescription className="text-xs">{scheme.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {scheme.projectCount || 0} projects
                </span>
                <div className="flex gap-1">
                  {!scheme.isDefault && (
                    <Button variant="ghost" size="icon" onClick={() => setAsDefault(scheme.id)} title="Set as default">
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" title="Edit">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteScheme(scheme.id)} title="Delete" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {schemes.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No permission schemes yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}

