'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  Wand2,
  AlertCircle,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
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

type IssueDraft = {
  type: 'story' | 'task' | 'bug' | 'epic' | 'subtask';
  title: string;
  description?: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  labels: string[];
  estimate?: number | null;
};

interface AiDraftIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

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

  // Single smart mutation — the LLM decides whether the prompt describes
  // one ticket or several. UI renders whatever count comes back.
  const draftMutation = useMutation({
    mutationFn: () => draftMany(projectId, prompt, 10),
    onSuccess: ({ drafts: ds, provider: p }) => {
      setDrafts(ds);
      setSelected(new Set(ds.map((_, i) => i)));
      setProvider(p);
    },
    onError: (err: Error) => {
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

  function reset() {
    setPrompt('');
    setDrafts([]);
    setSelected(new Set());
    setProvider(null);
    setCreatingIndex(null);
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
  }

  function toggleSelected(idx: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (!canDraft) return null;

  const isDrafting = draftMutation.isPending;
  const isCreating = bulkCreateMutation.isPending;
  const canSubmitPrompt = prompt.trim().length >= 3 && !isDrafting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Draft issues with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need in plain language. AI reads the prompt, decides whether it&apos;s
            one ticket or several, and returns editable drafts. Nothing is saved until you hit
            Create.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {drafts.length === 0 && (
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Prompt</Label>
              <Textarea
                id="ai-prompt"
                placeholder={
                  'One prompt can describe a single bug OR a whole checklist — AI splits on its own.\n\nExamples:\n• Navbar dropdown flickers on Safari below 640px.\n• Ship the mobile app: add offline mode, fix push delivery, refresh onboarding copy.'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                disabled={isDrafting || isCreating}
              />
              <p className="text-xs text-muted-foreground">{prompt.length}/6000</p>
            </div>
          )}

          {drafts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {drafts.length === 1 ? 'Draft' : `${drafts.length} drafts`}
                  {provider ? ` · ${provider}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrafts([])}
                    disabled={isCreating}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => draftMutation.mutate()}
                    disabled={isCreating || !canSubmitPrompt}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Re-draft
                  </Button>
                </div>
              </div>

              {drafts.map((draft, idx) => (
                <DraftCard
                  key={idx}
                  index={idx}
                  draft={draft}
                  multi={drafts.length > 1}
                  selected={selected.has(idx)}
                  creating={creatingIndex === idx}
                  onToggle={() => toggleSelected(idx)}
                  onRemove={() => removeDraft(idx)}
                  onChange={(patch) => updateDraft(idx, patch)}
                />
              ))}
            </div>
          )}

          {draftMutation.isError && drafts.length === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(draftMutation.error as Error).message}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isCreating}>
            Cancel
          </Button>
          {drafts.length === 0 ? (
            <Button onClick={() => draftMutation.mutate()} disabled={!canSubmitPrompt}>
              {isDrafting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-1.5 h-4 w-4" />
              Draft
            </Button>
          ) : (
            <Button
              onClick={() => bulkCreateMutation.mutate()}
              disabled={isCreating || selected.size === 0}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {selected.size === drafts.length ? 'all' : `${selected.size} of ${drafts.length}`}
            </Button>
          )}
        </DialogFooter>
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
            onClick={onToggle}
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
              maxLength={500}
              className="flex-1"
            />
          </div>
        </div>
        {multi && (
          <button
            type="button"
            onClick={onRemove}
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
            <SelectTrigger>
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
            <SelectTrigger>
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
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Labels (comma-separated)</Label>
        <Input
          value={draft.labels.join(', ')}
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
