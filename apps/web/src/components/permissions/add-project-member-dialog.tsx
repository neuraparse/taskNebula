'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
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
import { isApiPermissionError, throwApiResponseError } from '@/lib/client-api-errors';
import { useOrganization } from '@/lib/hooks/use-organization';
import { Ban, Check, Copy, Link2, Loader2, Search, UserPlus } from 'lucide-react';
import type { ProjectRole } from '@/lib/hooks/use-project-permissions';

interface OrgMember {
  id: string; // user id
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
  source?: 'organization_member' | 'registered_user';
}

interface MemberCandidatePayload {
  id?: string;
  userId?: string;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  source?: 'organization_member' | 'registered_user';
}

interface MemberCandidatesResponse {
  members: MemberCandidatePayload[];
  canInviteRegisteredUsers?: boolean;
}

interface ProjectInviteLink {
  id: string;
  role: ProjectRole;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
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

const INVITE_EXPIRY_OPTIONS = [1, 7, 14, 30, 90] as const;
const INVITE_MAX_USE_OPTIONS = [1, 2, 5, 10, 25] as const;

interface AddProjectMemberDialogProps {
  projectId: string;
  existingMemberUserIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void | Promise<void>;
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
  const formatter = useFormatter();
  const { toast } = useToast();
  const { currentOrganizationId } = useOrganization();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ProjectRole>('developer');
  const [submitting, setSubmitting] = useState(false);
  const [linkRole, setLinkRole] = useState<ProjectRole>('developer');
  const [linkExpiresInDays, setLinkExpiresInDays] = useState(7);
  const [linkMaxUses, setLinkMaxUses] = useState(1);
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokingLinkId, setRevokingLinkId] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const { data: orgMembersData, isLoading } = useQuery({
    queryKey: ['org-members-for-project-add', currentOrganizationId, projectId, search.trim()],
    queryFn: async () => {
      if (!currentOrganizationId) return { members: [] } satisfies MemberCandidatesResponse;
      const params = new URLSearchParams({
        projectId,
        limit: '300',
      });
      const trimmedSearch = search.trim();
      if (trimmedSearch) params.set('q', trimmedSearch);
      const res = await fetch(
        `/api/organizations/${currentOrganizationId}/member-candidates?${params.toString()}`
      );
      if (!res.ok) await throwApiResponseError(res);
      return res.json() as Promise<MemberCandidatesResponse>;
    },
    enabled: !!currentOrganizationId && open,
  });

  const {
    data: inviteLinksData,
    isLoading: inviteLinksLoading,
    refetch: refetchInviteLinks,
  } = useQuery({
    queryKey: ['project-invite-links', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/invite-links`);
      if (!res.ok) await throwApiResponseError(res);
      return res.json() as Promise<{ links: ProjectInviteLink[] }>;
    },
    enabled: open,
  });

  const candidates = useMemo<OrgMember[]>(() => {
    const list = Array.isArray(orgMembersData?.members) ? orgMembersData.members : [];
    const existing = new Set(existingMemberUserIds);
    const needle = search.trim().toLowerCase();
    return list
      .map(
        (m): OrgMember => ({
          id: m.user?.id ?? m.userId ?? m.id ?? '',
          name: m.user?.name ?? m.name ?? null,
          email: m.user?.email ?? m.email ?? null,
          image: m.user?.image ?? m.image ?? null,
          role: m.role ?? null,
          source: m.source ?? 'organization_member',
        })
      )
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
    setLinkRole('developer');
    setLinkExpiresInDays(7);
    setLinkMaxUses(1);
    setCreatingLink(false);
    setRevokingLinkId(null);
    setCreatedInviteUrl(null);
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
        await throwApiResponseError(res);
      }
      toast({ title: t('apm_member_added_title'), description: t('apm_member_added_description') });
      await onAdded?.();
      handleClose(false);
    } catch (error) {
      const msg = isApiPermissionError(error) ? t('pm_no_permission') : t('apm_add_failed');
      toast({ title: t('apm_add_failed_title'), description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInviteLink = async () => {
    setCreatingLink(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: linkRole,
          expiresInDays: linkExpiresInDays,
          maxUses: linkMaxUses,
        }),
      });
      if (!res.ok) {
        await throwApiResponseError(res);
      }

      const data = (await res.json().catch(() => ({}))) as { inviteUrl?: string };
      if (!data.inviteUrl) {
        throw new Error(t('apm_invite_link_create_failed'));
      }
      setCreatedInviteUrl(data.inviteUrl);
      await navigator.clipboard?.writeText(data.inviteUrl).catch(() => undefined);
      toast({
        title: t('apm_invite_link_created_title'),
        description: t('apm_invite_link_created_description'),
      });
      refetchInviteLinks();
    } catch (error) {
      const msg = isApiPermissionError(error)
        ? t('pm_no_permission')
        : t('apm_invite_link_create_failed');
      toast({
        title: t('apm_invite_link_create_failed_title'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!createdInviteUrl) return;
    await navigator.clipboard?.writeText(createdInviteUrl).catch(() => undefined);
    toast({ title: t('apm_invite_link_copied_title') });
  };

  const handleRevokeInviteLink = async (linkId: string) => {
    setRevokingLinkId(linkId);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite-links/${linkId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        await throwApiResponseError(res);
      }
      toast({ title: t('apm_invite_link_revoked_title') });
      refetchInviteLinks();
    } catch (error) {
      const msg = isApiPermissionError(error)
        ? t('pm_no_permission')
        : t('apm_invite_link_revoke_failed');
      toast({
        title: t('apm_invite_link_revoke_failed_title'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setRevokingLinkId(null);
    }
  };

  const inviteLinks = Array.isArray(inviteLinksData?.links) ? inviteLinksData.links : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[min(92dvh,760px)] w-[min(calc(100vw-1rem),720px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-md">
        <DialogHeader className="border-border shrink-0 border-b px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('apm_title')}
          </DialogTitle>
          <DialogDescription>{t('apm_description')}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
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
            <ScrollArea className="h-[min(32dvh,15rem)]">
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
                          ) : m.source === 'registered_user' ? (
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                              {t('apm_registered_user')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                              {m.role ?? t('apm_workspace_member')}
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

          <div className="border-border space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <Link2 className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('apm_invite_link_title')}</p>
                <p className="text-muted-foreground text-xs">{t('apm_invite_link_description')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="project-link-role">{t('apm_project_role')}</Label>
                <Select value={linkRole} onValueChange={(v) => setLinkRole(v as ProjectRole)}>
                  <SelectTrigger id="project-link-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {t(r.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-link-expiry">{t('apm_invite_link_expiry')}</Label>
                <Select
                  value={String(linkExpiresInDays)}
                  onValueChange={(v) => setLinkExpiresInDays(Number(v))}
                >
                  <SelectTrigger id="project-link-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_EXPIRY_OPTIONS.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {t('apm_invite_link_days', { count: days })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-link-max-uses">{t('apm_invite_link_max_uses')}</Label>
                <Select
                  value={String(linkMaxUses)}
                  onValueChange={(v) => setLinkMaxUses(Number(v))}
                >
                  <SelectTrigger id="project-link-max-uses">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_MAX_USE_OPTIONS.map((uses) => (
                      <SelectItem key={uses} value={String(uses)}>
                        {t('apm_invite_link_uses', { count: uses })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateInviteLink}
                disabled={creatingLink}
              >
                {creatingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('apm_invite_link_create')}
              </Button>
            </div>

            {createdInviteUrl ? (
              <div className="flex gap-2">
                <Input value={createdInviteUrl} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyInviteLink}
                  aria-label={t('apm_invite_link_copy')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">{t('apm_invite_link_active')}</p>
              {inviteLinksLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('apm_invite_link_loading')}
                </div>
              ) : inviteLinks.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t('apm_invite_link_empty')}</p>
              ) : (
                <div className="space-y-1.5">
                  {inviteLinks.slice(0, 5).map((link) => {
                    const status = getInviteLinkStatus(link);
                    const inactive = status !== 'active';
                    return (
                      <div
                        key={link.id}
                        className="bg-muted/30 flex items-center justify-between gap-3 rounded-md px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">
                            {t(`apm_invite_link_status_${status}`)} · {t(`pr_${link.role}`)}
                          </p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {t('apm_invite_link_meta', {
                              used: link.usedCount,
                              max: link.maxUses,
                              date: formatInviteDate(link.expiresAt, formatter),
                            })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInviteLink(link.id)}
                          disabled={inactive || revokingLinkId === link.id}
                        >
                          {revokingLinkId === link.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          {t('apm_invite_link_revoke')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-border shrink-0 gap-2 border-t px-4 py-3 sm:px-6">
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

function getInviteLinkStatus(link: ProjectInviteLink) {
  if (link.revokedAt) return 'revoked';
  if (new Date(link.expiresAt).getTime() <= Date.now()) return 'expired';
  if (link.usedCount >= link.maxUses) return 'used';
  return 'active';
}

type InviteDateFormatter = ReturnType<typeof useFormatter>;

function formatInviteDate(value: string, formatter: InviteDateFormatter) {
  return formatter.dateTime(new Date(value), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
