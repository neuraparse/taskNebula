'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
import { TEMPLATE_KINDS, useCreateTemplate, type TemplateKind } from './use-templates';

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
  const t = useTranslations('planning');
  const tActions = useTranslations('actions');
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
          title: t('toast_name_required_title'),
          description: t('toast_name_required_desc'),
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
            throw new Error(t('payload_must_be_object'));
          }
          payload = parsed as Record<string, unknown>;
          setPayloadError(null);
        } catch (err) {
          const message = err instanceof Error ? err.message : t('payload_invalid_json');
          setPayloadError(message);
          toast({
            title: t('toast_invalid_payload_title'),
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
              title: t('toast_template_created_title'),
              description: t('toast_template_created_desc', { name: template.name }),
            });
            handleOpenChange(false);
          },
          onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : t('toast_create_failed_desc');
            toast({
              title: t('toast_create_failed_title'),
              description: message,
              variant: 'destructive',
            });
          },
        }
      );
    },
    [createMutation, description, handleOpenChange, icon, kind, name, payloadText, toast, t]
  );

  const submitting = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t('new_template')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('create_template')}</DialogTitle>
            <DialogDescription>{t('create_template_desc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">{t('label_name')}</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name_placeholder')}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-description">{t('label_description')}</Label>
              <Textarea
                id="tpl-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="space-y-2">
                <Label htmlFor="tpl-kind">{t('label_kind')}</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as TemplateKind)}>
                  <SelectTrigger id="tpl-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`kind_${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-icon">{t('label_icon')}</Label>
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
              <Label htmlFor="tpl-payload">{t('label_payload')}</Label>
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
              <p className="text-muted-foreground text-[11px]">{KIND_HINTS[kind]}</p>
              {payloadError ? <p className="text-destructive text-[11px]">{payloadError}</p> : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {tActions('cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('create_template')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
