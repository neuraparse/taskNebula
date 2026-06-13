'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/lib/hooks/use-organization';
import { Loader2, Search, UserPlus, Check } from 'lucide-react';
import type { ProjectRole } from '@/lib/hooks/use-project-permissions';

interface OrgMember {
  id: string; // user id
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

const PROJECT_ROLES: Array<{ value: ProjectRole; labelKey: string; descriptionKey: string }> = [
  { value: 'product_owner', labelKey: 'pr_product_owner', descriptionKey: 'pr_product_owner_desc' },
  { value: 'scrum_master', labelKey: 'pr_scrum_master', descriptionKey: 'pr_scrum_master_desc' },
  { value: 'tech_lead', labelKey: 'pr_tech_lead', descriptionKey: 'pr_tech_lead_desc' },
  { value: 'developer', labelKey: 'pr_developer', descriptionKey: 'pr_developer_desc' },
  { value: 'qa_engineer', labelKey: 'pr_qa_engineer', descriptionKey: 'pr_qa_engineer_desc' },
  { value: 'designer', labelKey: 'pr_designer', descriptionKey: 'pr_designer_desc' },
  { value: 'viewer', labelKey: 'pr_viewer', descriptionKey: 'pr_viewer_desc' },
];

interface AddProjectMemberDialogProps {
  projectId: string;
  existingMemberUserIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}

export function AddProjectMemberDialog({
  projectId,
  existingMemberUserIds,
  open,
  onOpenChange,
  onAdded,
}: AddProjectMemberDialogProps) {
  const t = useTranslations('projectConfig');
  const tActions = useTranslations('actions');
  const { toast } = useToast();
  const { currentOrganizationId } = useOrganization();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ProjectRole>('developer');
  const [submitting, setSubmitting] = useState(false);

  const { data: orgMembersData, isLoading } = useQuery({
    queryKey: ['org-members-for-project-add', currentOrganizationId],
    queryFn: async () => {
      if (!currentOrganizationId) return { members: [] as OrgMember[] };
      const res = await fetch(`/api/organizations/${currentOrganizationId}/members?limit=200`);
      if (!res.ok) throw new Error('Failed to load organization members');
      return res.json();
    },
    enabled: !!currentOrganizationId && open,
  });

  const candidates = useMemo<OrgMember[]>(() => {
    const list: OrgMember[] = Array.isArray(orgMembersData?.members) ? orgMembersData.members : [];
    const existing = new Set(existingMemberUserIds);
    const needle = search.trim().toLowerCase();
    return list
      .map((m: any) => ({
        id: m.user?.id ?? m.userId ?? m.id,
        name: m.user?.name ?? m.name ?? null,
        email: m.user?.email ?? m.email ?? null,
        image: m.user?.image ?? m.image ?? null,
        role: m.role ?? 'member',
      }))
      .filter((m) => m.id && !existing.has(m.id))
      .filter((m) => {
        if (!needle) return true;
        return (
          (m.name ?? '').toLowerCase().includes(needle) ||
          (m.email ?? '').toLowerCase().includes(needle)
        );
      });
  }, [orgMembersData, existingMemberUserIds, search]);

  const reset = () => {
    setSearch('');
    setSelectedUserId(null);
    setRole('developer');
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to add project member');
      }
      toast({ title: t('apm_member_added_title'), description: t('apm_member_added_description') });
      onAdded?.();
      handleClose(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('apm_add_failed');
      toast({ title: t('apm_add_failed_title'), description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('apm_title')}
          </DialogTitle>
          <DialogDescription>{t('apm_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('apm_search_placeholder')}
              className="pl-9"
            />
          </div>

          <div className="border-border rounded-md border">
            <ScrollArea className="h-60">
              {isLoading ? (
                <div className="text-muted-foreground flex items-center justify-center py-10 text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('apm_loading_members')}
                </div>
              ) : candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
                  <p className="text-sm font-medium">{t('apm_nobody_to_add')}</p>
                  <p className="text-muted-foreground max-w-[260px] text-xs">
                    {search ? t('apm_no_matches') : t('apm_everyone_member')}
                  </p>
                </div>
              ) : (
                <ul className="divide-border/60 divide-y">
                  {candidates.map((m) => {
                    const active = selectedUserId === m.id;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(m.id)}
                          className={`hover:bg-accent/40 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-primary/5' : ''
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage
                              src={m.image || ''}
                              alt={m.name || m.email || t('apm_member_fallback')}
                            />
                            <AvatarFallback className="text-[11px]">
                              {(m.name || m.email || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{m.name || m.email}</p>
                            <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                          </div>
                          {active ? (
                            <Check className="text-primary h-4 w-4" aria-hidden="true" />
                          ) : (
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                              {m.role}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-role">{t('apm_project_role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
              <SelectTrigger id="project-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{t(r.labelKey)}</span>
                      <span className="text-muted-foreground text-xs">{t(r.descriptionKey)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            {tActions('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedUserId || submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('apm_add_to_project')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
