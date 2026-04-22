'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, Wand2, AlertCircle } from 'lucide-react';
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

async function draftIssueRequest(projectId: string, prompt: string): Promise<{
  draft: IssueDraft;
  provider: string;
}> {
  const response = await fetch('/api/ai/draft-issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, prompt }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    throw new Error(error.error || `Draft failed (${response.status})`);
  }
  return response.json();
}

async function createIssueRequest(projectId: string, draft: IssueDraft) {
  const response = await fetch('/api/issues', {
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
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || 'Failed to create issue');
  }
  return response.json();
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
  const [draft, setDraft] = useState<IssueDraft | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const draftMutation = useMutation({
    mutationFn: () => draftIssueRequest(projectId, prompt),
    onSuccess: (data) => {
      setDraft(data.draft);
      setProvider(data.provider);
    },
    onError: (err: Error) => {
      toast({
        title: 'Drafting failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('No draft available');
      return createIssueRequest(projectId, draft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['issues'],
        predicate: (query) => {
          const filters = query.queryKey[1] as { projectId?: string } | undefined;
          return filters?.projectId === projectId;
        },
      });
      toast({
        title: 'Issue created',
        description: draft?.title ?? 'AI-drafted issue created.',
      });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: 'Create failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  function reset() {
    setPrompt('');
    setDraft(null);
    setProvider(null);
    draftMutation.reset();
    createMutation.reset();
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  if (!canDraft) return null;

  const isDrafting = draftMutation.isPending;
  const isCreating = createMutation.isPending;
  const canSubmit = prompt.trim().length >= 3 && !isDrafting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Draft an issue with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you need in plain language. AI returns a structured draft you can edit
            before creating.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">Prompt</Label>
            <Textarea
              id="ai-prompt"
              placeholder="e.g. Navbar dropdown flickers on Safari when the viewport is narrower than 640px. Users report it on iOS 17+. Needs a fix before Friday."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={isDrafting || isCreating}
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length}/4000 characters
            </p>
          </div>

          {draft ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Draft{provider ? ` · ${provider}` : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => draftMutation.mutate()}
                  disabled={isDrafting || !canSubmit}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  Re-draft
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={draft.type}
                    onValueChange={(value) =>
                      setDraft({ ...draft, type: value as IssueDraft['type'] })
                    }
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
                    onValueChange={(value) =>
                      setDraft({ ...draft, priority: value as IssueDraft['priority'] })
                    }
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
                <Label className="text-xs" htmlFor="ai-draft-title">
                  Title
                </Label>
                <Input
                  id="ai-draft-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  maxLength={500}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="ai-draft-desc">
                  Description
                </Label>
                <Textarea
                  id="ai-draft-desc"
                  value={draft.description ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value || null })
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Labels</Label>
                <Input
                  value={draft.labels.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      labels: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 8),
                    })
                  }
                  placeholder="comma-separated"
                />
              </div>
            </div>
          ) : draftMutation.isError ? (
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
          {draft ? (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={isCreating || !draft.title.trim()}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create issue
            </Button>
          ) : (
            <Button onClick={() => draftMutation.mutate()} disabled={!canSubmit}>
              {isDrafting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-1.5 h-4 w-4" />
              Draft
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
