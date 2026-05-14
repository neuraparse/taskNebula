'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type ChatTurn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

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

export function AiDraftIssueDialog({
  open,
  onOpenChange,
  projectId,
}: AiDraftIssueDialogProps) {
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
            ds.length === 0
              ? 'No drafts produced — try refining the prompt.'
              : `Drafted ${ds.length} ${ds.length === 1 ? 'issue' : 'issues'} from your prompt.`,
        },
      ]);
    },
    onError: (err: Error) => {
      startedAtRef.current = null;
      setChat((c) => [...c, { role: 'assistant', content: `Drafting failed: ${err.message}` }]);
      toast({ title: 'Drafting failed', description: err.message, variant: 'destructive' });
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
        title: `${created.length} issue${created.length === 1 ? '' : 's'} created`,
        description: created.map((c) => c.key || c.title).slice(0, 3).join(', '),
      });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setCreatingIndex(null);
      toast({ title: 'Create failed', description: err.message, variant: 'destructive' });
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Draft issues with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need. AI splits it into editable drafts — preview on the right,
            confirm to create.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,360px] gap-0 max-h-[70vh] overflow-hidden">
          {/* LEFT — chat thread */}
          <div className="overflow-y-auto border-r border-border p-5 space-y-4">
            {chat.length === 0 && drafts.length === 0 && !isDrafting && (
              <p className="text-[13px] text-muted-foreground">
                One prompt can describe a single bug OR a whole checklist — AI splits on its own.
              </p>
            )}

            {chat.map((turn, i) =>
              turn.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-muted px-3 py-2 rounded-lg text-[13px] max-w-[80%] whitespace-pre-wrap">
                    {turn.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="text-[13px] text-foreground whitespace-pre-wrap">
                  {turn.content}
                </div>
              )
            )}

            {(isDrafting || lastThinkSeconds != null) && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setThoughtsOpen(!thoughtsOpen)}
                  className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>
                    Thought for {isDrafting ? elapsedSeconds : lastThinkSeconds}s
                  </span>
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${thoughtsOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                {thoughtsOpen && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground">
                    Reading prompt, classifying scope (single ticket vs checklist), then drafting
                    titles, types, priorities, and labels for each item.
                  </div>
                )}
              </div>
            )}

            {drafts.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <AiBadge
                      feature="Draft Issue"
                      model={provider ?? undefined}
                      generatedAt={new Date()}
                    />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {drafts.length === 1 ? 'Draft' : `${drafts.length} drafts`}
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
                      Back
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
                      Re-draft
                    </Button>
                  </div>
                </div>

                {drafts.map((draft, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDraftIndex(idx)}
                    className={`rounded-md transition-colors ${
                      selectedDraftIndex === idx ? 'ring-1 ring-primary' : ''
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
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{(draftMutation.error as Error).message}</span>
              </div>
            ) : null}

            {drafts.length === 0 && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="ai-prompt">Prompt</Label>
                <Textarea
                  id="ai-prompt"
                  placeholder={
                    'Examples:\n• Navbar dropdown flickers on Safari below 640px.\n• Ship the mobile app: add offline mode, fix push delivery, refresh onboarding copy.'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  disabled={isDrafting || isCreating}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{prompt.length}/6000</p>
                  <Button onClick={handleSubmitPrompt} disabled={!canSubmitPrompt} size="sm">
                    {isDrafting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Draft
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — live preview */}
          <aside className="overflow-y-auto bg-muted/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Live preview
              </div>
              {previewDraft && (
                <AiBadge
                  feature="Draft Issue"
                  model={provider ?? undefined}
                  generatedAt={new Date()}
                />
              )}
            </div>
            {previewDraft ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Project icon
                  </label>
                  <div className="mt-1 h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                    {TYPE_ICON[previewDraft.type] ?? '📋'}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Title
                  </label>
                  <div className="mt-1 text-[14px] font-medium">
                    {previewDraft.title || (
                      <span className="text-muted-foreground italic">Generating…</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Description
                  </label>
                  <div className="mt-1 text-[13px] text-foreground/80 whitespace-pre-wrap">
                    {previewDraft.description?.trim() ? (
                      previewDraft.description
                    ) : (
                      <span className="text-muted-foreground italic">No description</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Type
                    </label>
                    <div className="mt-1 text-[13px] capitalize">{previewDraft.type}</div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Priority
                    </label>
                    <div className="mt-1 text-[13px] capitalize">{previewDraft.priority}</div>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Labels
                  </label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {previewDraft.labels.length === 0 ? (
                      <span className="text-[13px] text-muted-foreground italic">None</span>
                    ) : (
                      previewDraft.labels.map((l) => (
                        <span
                          key={l}
                          className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[11px]"
                        >
                          {l}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {typeof previewDraft.estimate === 'number' && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Estimate
                    </label>
                    <div className="mt-1 text-[13px]">{previewDraft.estimate}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center text-center">
                <div className="space-y-2">
                  <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/60" />
                  <p className="text-[13px] text-muted-foreground">
                    {isDrafting ? 'Generating draft…' : 'Draft will appear here'}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Sticky bottom — Awaiting response confirm bar */}
        {drafts.length > 0 ? (
          <div className="border-t border-border bg-muted/40 px-5 py-3 flex items-center justify-between">
            <div className="text-[12.5px]">
              <div className="font-medium">Awaiting response</div>
              <div className="text-muted-foreground">
                {drafts.length} item{drafts.length !== 1 ? 's' : ''} ready to create. Confirm to
                continue.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isCreating}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => bulkCreateMutation.mutate()}
                disabled={isCreating || selected.size === 0}
                size="sm"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
                {selected.size > 0 && selected.size !== drafts.length
                  ? ` (${selected.size}/${drafts.length})`
                  : ''}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border px-5 py-3 flex items-center justify-end">
            <Button variant="outline" onClick={() => handleClose(false)} size="sm">
              Cancel
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
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start gap-3">
        {multi && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={selected ? 'Deselect' : 'Select'}
          >
            {selected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
            <Input
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
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove draft"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={draft.type}
            onValueChange={(value) => onChange({ type: value as IssueDraft['type'] })}
          >
            <SelectTrigger onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="epic">Epic</SelectItem>
              <SelectItem value="subtask">Subtask</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select
            value={draft.priority}
            onValueChange={(value) => onChange({ priority: value as IssueDraft['priority'] })}
          >
            <SelectTrigger onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={draft.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value || null })}
          onClick={(e) => e.stopPropagation()}
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Labels (comma-separated)</Label>
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
        <div className="flex items-center gap-2 text-xs text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Creating…
        </div>
      )}
    </div>
  );
}
