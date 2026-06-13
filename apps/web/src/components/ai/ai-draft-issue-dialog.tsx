'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  Wand2,
  AlertCircle,
  CheckSquare,
  Square,
  X,
  Brain,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAiCapability } from '@/lib/hooks/use-ai-capability';
import { AiBadge } from '@/components/ai/AiBadge';

type IssueDraft = {
  type: 'story' | 'task' | 'bug' | 'epic' | 'subtask';
  title: string;
  description?: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  labels: string[];
  estimate?: number | null;
};

type ChatTurn = { role: 'user'; content: string } | { role: 'assistant'; content: string };

interface AiDraftIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const TYPE_ICON: Record<IssueDraft['type'], string> = {
  story: '📖',
  task: '📋',
  bug: '🐛',
  epic: '🏔️',
  subtask: '🧩',
};

async function draftMany(
  projectId: string,
  prompt: string,
  maxCount: number
): Promise<{ drafts: IssueDraft[]; provider: string }> {
  const r = await fetch('/api/ai/draft-issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, prompt, maxCount }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Multi-draft failed (${r.status})`);
  }
  return r.json();
}

async function createIssue(projectId: string, draft: IssueDraft) {
  const r = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      type: draft.type,
      title: draft.title,
      description: draft.description ?? undefined,
      priority: draft.priority,
      labels: draft.labels,
      estimate: draft.estimate ?? undefined,
    }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to create issue');
  }
  return r.json();
}

export function AiDraftIssueDialog({ open, onOpenChange, projectId }: AiDraftIssueDialogProps) {
  const t = useTranslations('aiFeatures');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canDraft } = useAiCapability();

  const [prompt, setPrompt] = useState('');
  const [drafts, setDrafts] = useState<IssueDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [provider, setProvider] = useState<string | null>(null);
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);

  // Two-pane additions
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState<number | null>(null);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastThinkSeconds, setLastThinkSeconds] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Single smart mutation — the LLM decides whether the prompt describes
  // one ticket or several. UI renders whatever count comes back.
  const draftMutation = useMutation({
    mutationFn: () => draftMany(projectId, prompt, 10),
    onSuccess: ({ drafts: ds, provider: p }) => {
      setDrafts(ds);
      setSelected(new Set(ds.map((_, i) => i)));
      setProvider(p);
      setSelectedDraftIndex(ds.length > 0 ? 0 : null);
      const took = startedAtRef.current
        ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        : null;
      setLastThinkSeconds(took);
      startedAtRef.current = null;
      setChat((c) => [
        ...c,
        {
          role: 'assistant',
          content:
            ds.length === 0 ? t('draft.noDrafts') : t('draft.draftedCount', { count: ds.length }),
        },
      ]);
    },
    onError: (err: Error) => {
      startedAtRef.current = null;
      setChat((c) => [
        ...c,
        { role: 'assistant', content: t('draft.draftingFailedChat', { message: err.message }) },
      ]);
      toast({ title: t('draft.draftingFailed'), description: err.message, variant: 'destructive' });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async () => {
      const created: Array<{ title: string; key?: string }> = [];
      for (const idx of Array.from(selected).sort((a, b) => a - b)) {
        const draft = drafts[idx];
        if (!draft) continue;
        setCreatingIndex(idx);
        const issue = await createIssue(projectId, draft);
        created.push({ title: draft.title, key: issue?.key });
      }
      setCreatingIndex(null);
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ['issues'],
        predicate: (query) => {
          const filters = query.queryKey[1] as { projectId?: string } | undefined;
          return filters?.projectId === projectId;
        },
      });
      toast({
        title: t('draft.createdCount', { count: created.length }),
        description: created
          .map((c) => c.key || c.title)
          .slice(0, 3)
          .join(', '),
      });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setCreatingIndex(null);
      toast({ title: t('draft.createFailed'), description: err.message, variant: 'destructive' });
    },
  });

  const isDrafting = draftMutation.isPending;
  const isCreating = bulkCreateMutation.isPending;

  // Tick elapsed seconds while a draft request is in flight.
  useEffect(() => {
    if (!isDrafting) return;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    const id = window.setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isDrafting]);

  function reset() {
    setPrompt('');
    setDrafts([]);
    setSelected(new Set());
    setProvider(null);
    setCreatingIndex(null);
    setChat([]);
    setSelectedDraftIndex(null);
    setThoughtsOpen(false);
    setElapsedSeconds(0);
    setLastThinkSeconds(null);
    startedAtRef.current = null;
    draftMutation.reset();
    bulkCreateMutation.reset();
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function updateDraft(idx: number, patch: Partial<IssueDraft>) {
    setDrafts((current) => current.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function removeDraft(idx: number) {
    setDrafts((current) => current.filter((_, i) => i !== idx));
    setSelected((current) => {
      const next = new Set<number>();
      for (const s of current) {
        if (s === idx) continue;
        next.add(s > idx ? s - 1 : s);
      }
      return next;
    });
    setSelectedDraftIndex((cur) => {
      if (cur == null) return cur;
      if (cur === idx) return null;
      return cur > idx ? cur - 1 : cur;
    });
  }

  function toggleSelected(idx: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handleSubmitPrompt() {
    const trimmed = prompt.trim();
    if (trimmed.length < 3 || isDrafting) return;
    setChat((c) => [...c, { role: 'user', content: trimmed }]);
    setLastThinkSeconds(null);
    draftMutation.mutate();
  }

  const canSubmitPrompt = prompt.trim().length >= 3 && !isDrafting;

  const previewDraft = useMemo<IssueDraft | null>(() => {
    if (drafts.length === 0) return null;
    if (selectedDraftIndex != null && drafts[selectedDraftIndex]) {
      return drafts[selectedDraftIndex];
    }
    return drafts[drafts.length - 1] ?? null;
  }, [drafts, selectedDraftIndex]);

  if (!canDraft) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-border border-b px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-4 w-4" />
            {t('draft.title')}
          </DialogTitle>
          <DialogDescription>{t('draft.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr,360px]">
          {/* LEFT — chat thread */}
          <div className="border-border space-y-4 overflow-y-auto border-r p-5">
            {chat.length === 0 && drafts.length === 0 && !isDrafting && (
              <p className="text-muted-foreground text-[13px]">{t('draft.emptyHint')}</p>
            )}

            {chat.map((turn, i) =>
              turn.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-muted max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px]">
                    {turn.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="text-foreground whitespace-pre-wrap text-[13px]">
                  {turn.content}
                </div>
              )
            )}

            {(isDrafting || lastThinkSeconds != null) && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setThoughtsOpen(!thoughtsOpen)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[12px]"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>
                    {t('draft.thoughtForSeconds', {
                      seconds: isDrafting ? elapsedSeconds : (lastThinkSeconds ?? 0),
                    })}
                  </span>
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${thoughtsOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                {thoughtsOpen && (
                  <div className="border-border bg-muted/30 text-muted-foreground rounded-md border p-3 text-[12px]">
                    {t('draft.thinkingTrace')}
                  </div>
                )}
              </div>
            )}

            {drafts.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <AiBadge
                      feature={t('draft.featureName')}
                      model={provider ?? undefined}
                      generatedAt={new Date()}
                    />
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('draft.draftsLabel', { count: drafts.length })}
                      {provider ? ` · ${provider}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDrafts([]);
                        setSelectedDraftIndex(null);
                      }}
                      disabled={isCreating}
                    >
                      {t('draft.back')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLastThinkSeconds(null);
                        draftMutation.mutate();
                      }}
                      disabled={isCreating || isDrafting}
                    >
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                      {t('draft.reDraft')}
                    </Button>
                  </div>
                </div>

                {drafts.map((draft, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDraftIndex(idx)}
                    className={`rounded-md transition-colors ${
                      selectedDraftIndex === idx ? 'ring-primary ring-1' : ''
                    }`}
                  >
                    <DraftCard
                      index={idx}
                      draft={draft}
                      multi={drafts.length > 1}
                      selected={selected.has(idx)}
                      creating={creatingIndex === idx}
                      onToggle={() => toggleSelected(idx)}
                      onRemove={() => removeDraft(idx)}
                      onChange={(patch) => updateDraft(idx, patch)}
                    />
                  </div>
                ))}
              </div>
            )}

            {draftMutation.isError && drafts.length === 0 ? (
              <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{(draftMutation.error as Error).message}</span>
              </div>
            ) : null}

            {drafts.length === 0 && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="ai-prompt">{t('draft.promptLabel')}</Label>
                <Textarea
                  id="ai-prompt"
                  placeholder={t('draft.promptPlaceholder')}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  disabled={isDrafting || isCreating}
                />
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {t('draft.charCount', { count: prompt.length, max: 6000 })}
                  </p>
                  <Button onClick={handleSubmitPrompt} disabled={!canSubmitPrompt} size="sm">
                    {isDrafting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    {t('draft.draftButton')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — live preview */}
          <aside className="bg-muted/20 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-muted-foreground text-[11px] uppercase tracking-wider">
                {t('draft.livePreview')}
              </div>
              {previewDraft && (
                <AiBadge
                  feature={t('draft.featureName')}
                  model={provider ?? undefined}
                  generatedAt={new Date()}
                />
              )}
            </div>
            {previewDraft ? (
              <div className="space-y-4">
                <div>
                  <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    {t('draft.projectIcon')}
                  </label>
                  <div className="bg-muted mt-1 flex h-12 w-12 items-center justify-center rounded-lg text-2xl">
                    {TYPE_ICON[previewDraft.type] ?? '📋'}
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    {t('draft.titleField')}
                  </label>
                  <div className="mt-1 text-[14px] font-medium">
                    {previewDraft.title || (
                      <span className="text-muted-foreground italic">{t('draft.generating')}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    {t('draft.descriptionField')}
                  </label>
                  <div className="text-foreground/80 mt-1 whitespace-pre-wrap text-[13px]">
                    {previewDraft.description?.trim() ? (
                      previewDraft.description
                    ) : (
                      <span className="text-muted-foreground italic">
                        {t('draft.noDescription')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                      {t('draft.typeField')}
                    </label>
                    <div className="mt-1 text-[13px] capitalize">{previewDraft.type}</div>
                  </div>
                  <div>
                    <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                      {t('draft.priorityField')}
                    </label>
                    <div className="mt-1 text-[13px] capitalize">{previewDraft.priority}</div>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    {t('draft.labelsField')}
                  </label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {previewDraft.labels.length === 0 ? (
                      <span className="text-muted-foreground text-[13px] italic">
                        {t('draft.none')}
                      </span>
                    ) : (
                      previewDraft.labels.map((l) => (
                        <span
                          key={l}
                          className="border-border bg-background inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]"
                        >
                          {l}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {typeof previewDraft.estimate === 'number' && (
                  <div>
                    <label className="text-muted-foreground text-[11px] uppercase tracking-wider">
                      {t('draft.estimateField')}
                    </label>
                    <div className="mt-1 text-[13px]">{previewDraft.estimate}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center text-center">
                <div className="space-y-2">
                  <Sparkles className="text-muted-foreground/60 mx-auto h-6 w-6" />
                  <p className="text-muted-foreground text-[13px]">
                    {isDrafting ? t('draft.generatingDraft') : t('draft.draftWillAppear')}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Sticky bottom — Awaiting response confirm bar */}
        {drafts.length > 0 ? (
          <div className="border-border bg-muted/40 flex items-center justify-between border-t px-5 py-3">
            <div className="text-[12.5px]">
              <div className="font-medium">{t('draft.awaitingResponse')}</div>
              <div className="text-muted-foreground">
                {t('draft.itemsReady', { count: drafts.length })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isCreating}
                size="sm"
              >
                {t('draft.cancel')}
              </Button>
              <Button
                onClick={() => bulkCreateMutation.mutate()}
                disabled={isCreating || selected.size === 0}
                size="sm"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('draft.confirm')}
                {selected.size > 0 && selected.size !== drafts.length
                  ? ` (${selected.size}/${drafts.length})`
                  : ''}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-border flex items-center justify-end border-t px-5 py-3">
            <Button variant="outline" onClick={() => handleClose(false)} size="sm">
              {t('draft.cancel')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DraftCard({
  index,
  draft,
  multi,
  selected,
  creating,
  onToggle,
  onRemove,
  onChange,
}: {
  index: number;
  draft: IssueDraft;
  multi: boolean;
  selected: boolean;
  creating: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<IssueDraft>) => void;
}) {
  const t = useTranslations('aiFeatures');
  return (
    <div className="border-border bg-muted/20 space-y-3 rounded-md border p-3">
      <div className="flex items-start gap-3">
        {multi && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-muted-foreground hover:text-foreground mt-1 shrink-0"
            aria-label={selected ? t('draft.deselect') : t('draft.select')}
          >
            {selected ? (
              <CheckSquare className="text-primary h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">#{index + 1}</span>
            <Input
              aria-label={t('draft.draftTitleAria', { index: index + 1 })}
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              maxLength={500}
              className="flex-1"
            />
          </div>
        </div>
        {multi && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label={t('draft.removeDraft')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('draft.typeField')}</Label>
          <Select
            value={draft.type}
            onValueChange={(value) => onChange({ type: value as IssueDraft['type'] })}
          >
            <SelectTrigger onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="task">{t('draft.typeTask')}</SelectItem>
              <SelectItem value="story">{t('draft.typeStory')}</SelectItem>
              <SelectItem value="bug">{t('draft.typeBug')}</SelectItem>
              <SelectItem value="epic">{t('draft.typeEpic')}</SelectItem>
              <SelectItem value="subtask">{t('draft.typeSubtask')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('draft.priorityField')}</Label>
          <Select
            value={draft.priority}
            onValueChange={(value) => onChange({ priority: value as IssueDraft['priority'] })}
          >
            <SelectTrigger onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">{t('draft.priorityCritical')}</SelectItem>
              <SelectItem value="high">{t('draft.priorityHigh')}</SelectItem>
              <SelectItem value="medium">{t('draft.priorityMedium')}</SelectItem>
              <SelectItem value="low">{t('draft.priorityLow')}</SelectItem>
              <SelectItem value="none">{t('draft.priorityNone')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t('draft.descriptionField')}</Label>
        <Textarea
          value={draft.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value || null })}
          onClick={(e) => e.stopPropagation()}
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t('draft.labelsCommaSeparated')}</Label>
        <Input
          value={draft.labels.join(', ')}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            onChange({
              labels: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
        />
      </div>

      {creating && (
        <div className="text-primary flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('draft.creating')}
        </div>
      )}
    </div>
  );
}
