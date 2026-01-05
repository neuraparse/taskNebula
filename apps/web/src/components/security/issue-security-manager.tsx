'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Plus, Lock, Eye, EyeOff, Trash2, Edit, Star, Users, User, UserCheck } from 'lucide-react';

interface SecurityLevel {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
  members: { id: string; memberType: string; memberValue: string | null }[];
}

interface SecurityScheme {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  levels: SecurityLevel[];
  createdAt: string;
  projectCount?: number;
}

interface IssueSecurityManagerProps {
  organizationId: string;
}

const MEMBER_TYPES = [
  { value: 'reporter', label: 'Reporter', icon: User, description: 'Issue reporter' },
  { value: 'assignee', label: 'Assignee', icon: UserCheck, description: 'Issue assignee' },
  { value: 'project_lead', label: 'Project Lead', icon: Users, description: 'Project lead' },
  { value: 'project_role', label: 'Project Role', icon: Users, description: 'Specific project role' },
  { value: 'anyone', label: 'Anyone', icon: Eye, description: 'All logged-in users' },
];

export function IssueSecurityManager({ organizationId }: IssueSecurityManagerProps) {
  const [schemes, setSchemes] = useState<SecurityScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newScheme, setNewScheme] = useState({ name: '', description: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchSchemes();
  }, [organizationId]);

  const fetchSchemes = async () => {
    try {
      const res = await fetch(`/api/security-schemes?organizationId=${organizationId}`);
      if (res.ok) {
        const data = await res.json();
        setSchemes(data);
      }
    } catch (error) {
      console.error('Error fetching security schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createScheme = async () => {
    try {
      const res = await fetch('/api/security-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name: newScheme.name,
          description: newScheme.description,
          levels: [
            { name: 'Internal', description: 'Visible to team members only', members: [{ type: 'project_role', value: 'developer' }] },
            { name: 'Confidential', description: 'Visible to leads and admins only', members: [{ type: 'project_role', value: 'tech_lead' }] },
            { name: 'Restricted', description: 'Visible to reporter and assignee only', members: [{ type: 'reporter' }, { type: 'assignee' }] },
          ],
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Security scheme created with default levels' });
        setCreateDialogOpen(false);
        setNewScheme({ name: '', description: '' });
        fetchSchemes();
      } else {
        const error = await res.json();
        toast({ title: 'Error', description: error.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create scheme', variant: 'destructive' });
    }
  };

  const deleteScheme = async (schemeId: string) => {
    try {
      const res = await fetch(`/api/security-schemes/${schemeId}`, { method: 'DELETE' });
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

  const getMemberIcon = (type: string) => {
    const memberType = MEMBER_TYPES.find(m => m.value === type);
    return memberType?.icon || User;
  };

  const getMemberLabel = (type: string, value: string | null) => {
    if (type === 'project_role' && value) {
      return value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    const memberType = MEMBER_TYPES.find(m => m.value === type);
    return memberType?.label || type;
  };

  if (loading) {
    return <div className="p-4">Loading security schemes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Issue Security Schemes</h3>
          <p className="text-sm text-muted-foreground">
            Control who can view sensitive issues
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Create Scheme</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Security Scheme</DialogTitle>
              <DialogDescription>Create a new issue security scheme with default levels</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newScheme.name} onChange={(e) => setNewScheme({ ...newScheme, name: e.target.value })} placeholder="e.g., Standard Security" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newScheme.description} onChange={(e) => setNewScheme({ ...newScheme, description: e.target.value })} placeholder="Describe this security scheme..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={createScheme} disabled={!newScheme.name}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-4">
        {schemes.map((scheme) => (
          <Card key={scheme.id} className={scheme.isDefault ? 'border-primary' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{scheme.name}</CardTitle>
                  {scheme.isDefault && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Star className="h-3 w-3" /> Default
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" title="Edit"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteScheme(scheme.id)} title="Delete" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {scheme.description && <CardDescription className="text-xs">{scheme.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="levels" className="border-none">
                  <AccordionTrigger className="py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4" />
                      {scheme.levels.length} Security Levels
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {scheme.levels.map((level) => (
                        <div key={level.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{level.name}</span>
                              {level.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                            </div>
                            {level.description && <p className="text-xs text-muted-foreground">{level.description}</p>}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {level.members.map((member) => {
                                const Icon = getMemberIcon(member.memberType);
                                return (
                                  <Badge key={member.id} variant="secondary" className="text-xs flex items-center gap-1">
                                    <Icon className="h-3 w-3" />
                                    {getMemberLabel(member.memberType, member.memberValue)}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))}
        {schemes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No security schemes yet. Create one to control issue visibility.</p>
          </div>
        )}
      </div>
    </div>
  );
}

