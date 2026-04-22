'use client';

import * as React from 'react';
import { Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  TEMPLATE_KINDS,
  useCreateTemplate,
  type TemplateKind,
} from './use-templates';

const KIND_LABELS: Record<TemplateKind, string> = {
  project: 'Project',
  issue: 'Issue',
  doc: 'Doc',
};

const KIND_HINTS: Record<TemplateKind, string> = {
  project:
    'Payload shape: { "name"?: string, "key"?: string, "description"?: string, "settings"?: object }',
  issue:
    'Payload shape: { "title"?: string, "description"?: string, "type"?: "task"|"bug"|"story"|"epic", "priority"?: "critical"|"high"|"medium"|"low"|"none", "labels"?: string[], "estimate"?: number }',
  doc: 'Payload shape: { "title"?: string, "contentJson"?: object, "icon"?: string }',
};

interface NewTemplateDialogProps {
  /** Optional trigger override (defaults to a "+ New template" primary button). */
  trigger?: React.ReactNode;
}

export function NewTemplateDialog({ trigger }: NewTemplateDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<TemplateKind>('project');
  const [icon, setIcon] = React.useState('');
  const [payloadText, setPayloadText] = React.useState('{}');
  const [payloadError, setPayloadError] = React.useState<string | null>(null);

  const { toast } = useToast();
  const createMutation = useCreateTemplate();

  const reset = React.useCallback(() => {
    setName('');
    setDescription('');
    setKind('project');
    setIcon('');
    setPayloadText('{}');
    setPayloadError(null);
  }, []);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) reset();
    },
    [reset]
  );

  const handleSubmit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();

      if (!name.trim()) {
        toast({
          title: 'Name is required',
          description: 'Give your template a short, descriptive name.',
          variant: 'destructive',
        });
        return;
      }

      let payload: Record<string, unknown> = {};
      const raw = payloadText.trim();
      if (raw.length > 0) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Payload must be a JSON object.');
          }
          payload = parsed as Record<string, unknown>;
          setPayloadError(null);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Invalid JSON payload.';
          setPayloadError(message);
          toast({
            title: 'Invalid payload JSON',
            description: message,
            variant: 'destructive',
          });
          return;
        }
      }

      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || null,
          kind,
          icon: icon.trim() || null,
          payload,
        },
        {
          onSuccess: (template) => {
            toast({
              title: 'Template created',
              description: `"${template.name}" is ready to use.`,
            });
            handleOpenChange(false);
          },
          onError: (error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : 'Could not create the template.';
            toast({
              title: 'Failed to create template',
              description: message,
              variant: 'destructive',
            });
          },
        }
      );
    },
    [
      createMutation,
      description,
      handleOpenChange,
      icon,
      kind,
      name,
      payloadText,
      toast,
    ]
  );

  const submitting = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create template</DialogTitle>
            <DialogDescription>
              Templates let your team spin up projects, issues, or docs with one
              click. Payload is stored as JSON and used when someone presses
              "Use template".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bug report, Sprint retro, Onboarding project…"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-description">Description</Label>
              <Textarea
                id="tpl-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this template for?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="space-y-2">
                <Label htmlFor="tpl-kind">Kind</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as TemplateKind)}
                >
                  <SelectTrigger id="tpl-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-icon">Icon</Label>
                <Input
                  id="tpl-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🚀"
                  maxLength={4}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-payload">Payload (JSON)</Label>
              <Textarea
                id="tpl-payload"
                value={payloadText}
                onChange={(e) => {
                  setPayloadText(e.target.value);
                  if (payloadError) setPayloadError(null);
                }}
                rows={6}
                spellCheck={false}
                className="font-mono text-xs"
                aria-invalid={payloadError ? true : undefined}
              />
              <p className="text-[11px] text-muted-foreground">
                {KIND_HINTS[kind]}
              </p>
              {payloadError ? (
                <p className="text-[11px] text-destructive">{payloadError}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
