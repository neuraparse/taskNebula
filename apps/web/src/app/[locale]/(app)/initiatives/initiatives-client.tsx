'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Layers3, Loader2, Plus, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InitiativeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  color: string | null;
  workspaceId: string;
  parentInitiativeId: string | null;
  children: InitiativeNode[];
}

interface InitiativesListResponse {
  initiatives: InitiativeNode[];
  flat: InitiativeNode[];
}

interface RollUpResponse {
  initiativeId: string;
  done: number;
  total: number;
  percent: number;
  projectCount: number;
}

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, string> = {
    planned: 'bg-muted text-muted-foreground',
    active: 'bg-emerald-500/15 text-emerald-600',
    paused: 'bg-amber-500/15 text-amber-600',
    complete: 'bg-blue-500/15 text-blue-600',
    cancelled: 'bg-rose-500/15 text-rose-600',
  };
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] uppercase tracking-wider', variant[status] ?? variant.planned)}
    >
      {status}
    </Badge>
  );
}

function InitiativeRow({ node, depth }: { node: InitiativeNode; depth: number }) {
  const t = useTranslations('pagesHome');
  const errorT = useTranslations('componentErrors.initiatives');
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  // Roll-up is fetched per-row but is cheap (small response) and cached.
  const { data: rollup } = useQuery<RollUpResponse>({
    queryKey: ['initiative-rollup', node.id],
    queryFn: async () => {
      const res = await fetch(`/api/initiatives/${node.id}/roll-up`);
      if (!res.ok) throw new Error(errorT('loadRollup'));
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="border-border border-b last:border-b-0">
      <div
        className="hover:bg-accent/40 flex items-center gap-3 px-3 py-2.5 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <button
          type="button"
          aria-label={expanded ? t('initiative_collapse') : t('initiative_expand')}
          onClick={() => setExpanded((v) => !v)}
          className={cn('text-muted-foreground h-4 w-4 shrink-0', !hasChildren && 'invisible')}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <Target className="text-muted-foreground h-4 w-4 shrink-0" />

        <Link
          href={`/initiatives/${node.id}`}
          className="text-foreground hover:text-primary min-w-0 flex-1 truncate text-sm font-medium"
        >
          {node.name}
        </Link>

        <StatusBadge status={node.status} />

        <div className="w-40 shrink-0">
          <Progress value={rollup?.percent ?? 0} className="h-2" />
        </div>
        <div className="text-muted-foreground w-12 shrink-0 text-right font-mono text-xs tabular-nums">
          {rollup ? `${rollup.percent}%` : '—'}
        </div>
        <div className="text-muted-foreground w-24 shrink-0 text-right text-xs">
          {node.targetDate ?? '—'}
        </div>
      </div>

      {expanded && hasChildren ? (
        <div className="bg-surface/40">
          {node.children.map((child) => (
            <InitiativeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InitiativesClient() {
  const t = useTranslations('pagesHome');
  const errorT = useTranslations('componentErrors.initiatives');
  const queryClient = useQueryClient();
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery<InitiativesListResponse>({
    queryKey: ['initiatives-list'],
    queryFn: async () => {
      const res = await fetch('/api/initiatives');
      if (!res.ok) throw new Error(errorT('fetchList'));
      return res.json();
    },
  });

  const createInitiative = useMutation({
    mutationFn: async (input: { name: string; description: string }) => {
      if (!currentOrganizationId) {
        throw new Error(t('initiatives_error_no_workspace'));
      }
      const res = await fetch('/api/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentOrganizationId,
          name: input.name,
          description: input.description || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || t('initiatives_error_create'));
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initiatives-list'] });
      setIsCreateOpen(false);
      setName('');
      setDescription('');
      toast({
        title: t('initiatives_toast_created_title'),
        description: t('initiatives_toast_created_description'),
      });
    },
    onError: () => {
      toast({
        title: t('initiatives_toast_error_title'),
        description: t('initiatives_error_generic'),
        variant: 'destructive',
      });
    },
  });

  const canCreate = Boolean(currentOrganizationId);
  const isEmpty = !data?.initiatives || data.initiatives.length === 0;

  function resetDialog() {
    setIsCreateOpen(false);
    setName('');
    setDescription('');
  }

  return (
    <div className="animate-fade-in flex h-full flex-col">
      <div className="border-border bg-background border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="kicker">{t('initiatives_kicker')}</span>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Layers3 className="text-muted-foreground h-5 w-5" />
              {t('initiatives_title')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('initiatives_subtitle')}</p>
          </div>
          {canCreate ? (
            <Button size="sm" className="shrink-0" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('initiatives_new')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <Card>
            <CardContent className="text-muted-foreground flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('initiatives_loading')}
            </CardContent>
          </Card>
        ) : isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="bg-surface text-muted-foreground flex h-10 w-10 items-center justify-center rounded-md">
                <Layers3 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground text-sm font-medium">
                  {t('initiatives_empty_title')}
                </p>
                <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                  {t('initiatives_empty_description')}
                </p>
              </div>
              {canCreate ? (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('initiatives_new')}
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t('initiatives_empty_no_workspace')}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('initiatives_tree')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-border bg-surface text-muted-foreground flex items-center gap-3 border-b px-3 py-2 text-[10px] font-medium uppercase tracking-wider">
                <div className="h-4 w-4 shrink-0" />
                <div className="h-4 w-4 shrink-0" />
                <div className="flex-1">{t('initiatives_col_name')}</div>
                <div className="w-[68px] shrink-0">{t('initiatives_col_status')}</div>
                <div className="w-40 shrink-0">{t('initiatives_col_progress')}</div>
                <div className="w-12 shrink-0 text-right">{t('initiatives_col_percent')}</div>
                <div className="w-24 shrink-0 text-right">{t('initiatives_col_target')}</div>
              </div>
              {data!.initiatives.map((node) => (
                <InitiativeRow key={node.id} node={node} depth={0} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => (open ? setIsCreateOpen(true) : resetDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('initiatives_new')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="initiative-name">{t('initiatives_form_name')}</Label>
              <Input
                id="initiative-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('initiatives_form_name_placeholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initiative-description">{t('initiatives_form_description')}</Label>
              <Textarea
                id="initiative-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('initiatives_form_description_placeholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetDialog}>
              {t('initiatives_form_cancel')}
            </Button>
            <Button
              onClick={() =>
                createInitiative.mutate({ name: name.trim(), description: description.trim() })
              }
              disabled={!name.trim() || !canCreate || createInitiative.isPending}
            >
              {createInitiative.isPending
                ? t('initiatives_form_creating')
                : t('initiatives_form_submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
