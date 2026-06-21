'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  isApiConflictError,
  isApiPermissionError,
  throwApiResponseError,
} from '@/lib/client-api-errors';
import { cn } from '@/lib/utils';

export interface OrgLabel {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  usageCount: number;
}

interface LabelsResponse {
  labels: OrgLabel[];
}

/**
 * Fixed palette offered in the picker — hex values mirroring the semantic
 * accent ramp (gray default, blue, violet, cyan, emerald, amber, rose, indigo).
 * The DB stores the raw hex (`labels.color`, default #6B7280).
 */
const LABEL_COLOR_PALETTE = [
  '#6B7280',
  '#3B82F6',
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#F43F5E',
  '#6366F1',
] as const;

function useLabels(organizationId: string) {
  return useQuery({
    queryKey: ['labels', organizationId],
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId });
      const response = await fetch(`/api/labels?${params.toString()}`);
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as LabelsResponse;
    },
    enabled: Boolean(organizationId),
  });
}

function useInvalidateLabels(organizationId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['labels', organizationId] });
    // Renames/deletes cascade into issues server-side — refresh issue lists too.
    void queryClient.invalidateQueries({ queryKey: ['issues'] });
  };
}

function useCreateLabel(organizationId: string) {
  const invalidate = useInvalidateLabels(organizationId);
  return useMutation({
    mutationFn: async (data: { name: string; color: string; description?: string }) => {
      const response = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, ...data }),
      });
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as OrgLabel;
    },
    onSuccess: invalidate,
  });
}

function useUpdateLabel(organizationId: string) {
  const invalidate = useInvalidateLabels(organizationId);
  return useMutation({
    mutationFn: async ({
      labelId,
      ...data
    }: {
      labelId: string;
      name?: string;
      color?: string;
      description?: string | null;
    }) => {
      const response = await fetch(`/api/labels/${labelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as OrgLabel;
    },
    onSuccess: invalidate,
  });
}

function useDeleteLabel(organizationId: string) {
  const invalidate = useInvalidateLabels(organizationId);
  return useMutation({
    mutationFn: async (labelId: string) => {
      const response = await fetch(`/api/labels/${labelId}`, { method: 'DELETE' });
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as { success: boolean; id: string };
    },
    onSuccess: invalidate,
  });
}

export interface LabelsManagerProps {
  organizationId: string;
}

export function LabelsManager({ organizationId }: LabelsManagerProps) {
  const t = useTranslations('settings.labels');
  const tSettings = useTranslations('settings');
  const tActions = useTranslations('actions');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<OrgLabel | null>(null);
  const [deletingLabel, setDeletingLabel] = useState<OrgLabel | null>(null);

  const { data, isLoading } = useLabels(organizationId);
  const deleteLabel = useDeleteLabel(organizationId);

  const labelList = data?.labels ?? [];

  const handleDelete = async () => {
    if (!deletingLabel) return;
    try {
      await deleteLabel.mutateAsync(deletingLabel.id);
      toast({ title: t('toast_deleted'), variant: 'success' });
      setDeletingLabel(null);
    } catch (error) {
      toast({
        title: isApiPermissionError(error) ? tSettings('error_no_permission') : t('error_generic'),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <span className="kicker">{t('kicker')}</span>
        <p className="text-muted-foreground mt-2 text-sm">{tCommon('loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="surface-card animate-fade-up space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="kicker">{t('kicker')}</span>
            <h3 className="text-sm font-semibold tracking-tight">{t('title')}</h3>
            <p className="text-muted-foreground text-xs">{t('subtitle')}</p>
          </div>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('new_label')}
          </Button>
        </div>

        {labelList.length === 0 ? (
          <div className="space-y-2 py-10 text-center">
            <Tags className="text-muted-foreground/40 mx-auto h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('create_first')}
            </Button>
          </div>
        ) : (
          <div className="stagger divide-border/60 -mx-1 divide-y">
            {labelList.map((label) => (
              <div
                key={label.id}
                className="row-interactive group flex items-center gap-3 px-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className="border-border/50 h-3 w-3 shrink-0 rounded-sm border"
                  style={{ backgroundColor: label.color }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{label.name}</span>
                    <span className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium">
                      {t('usage_count', { count: label.usageCount })}
                    </span>
                    {label.projectId !== null && (
                      <span className="border-accent-indigo/20 bg-accent-indigo/10 text-accent-indigo inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium">
                        {t('project_scoped')}
                      </span>
                    )}
                  </div>
                  {label.description && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {label.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditingLabel(label)}
                    aria-label={t('edit_title')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    onClick={() => setDeletingLabel(label)}
                    aria-label={t('delete_submit')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LabelEditorDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        organizationId={organizationId}
      />
      <LabelEditorDialog
        open={Boolean(editingLabel)}
        onOpenChange={(open) => {
          if (!open) setEditingLabel(null);
        }}
        organizationId={organizationId}
        labelToEdit={editingLabel}
      />

      <Dialog
        open={Boolean(deletingLabel)}
        onOpenChange={(open) => {
          if (!open) setDeletingLabel(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('delete_title')}</DialogTitle>
            <DialogDescription>
              {t('delete_warning', { name: deletingLabel?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingLabel(null)}>
              {tActions('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLabel.isPending}
            >
              {deleteLabel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete_submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface LabelEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  labelToEdit?: OrgLabel | null;
}

function LabelEditorDialog({
  open,
  onOpenChange,
  organizationId,
  labelToEdit,
}: LabelEditorDialogProps) {
  const t = useTranslations('settings.labels');
  const tSettings = useTranslations('settings');
  const tActions = useTranslations('actions');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(LABEL_COLOR_PALETTE[0]);
  const [description, setDescription] = useState('');

  const createLabel = useCreateLabel(organizationId);
  const updateLabel = useUpdateLabel(organizationId);

  const isEditMode = Boolean(labelToEdit);
  const isPending = createLabel.isPending || updateLabel.isPending;

  useEffect(() => {
    if (!open) return;

    if (labelToEdit) {
      setName(labelToEdit.name);
      setColor(labelToEdit.color);
      setDescription(labelToEdit.description ?? '');
      return;
    }

    setName('');
    setColor(LABEL_COLOR_PALETTE[0]);
    setDescription('');
  }, [labelToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      if (labelToEdit) {
        await updateLabel.mutateAsync({
          labelId: labelToEdit.id,
          name: trimmedName,
          color,
          description: description.trim() ? description.trim() : null,
        });
        toast({ title: t('toast_updated'), variant: 'success' });
      } else {
        await createLabel.mutateAsync({
          name: trimmedName,
          color,
          ...(description.trim() ? { description: description.trim() } : {}),
        });
        toast({ title: t('toast_created'), variant: 'success' });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: isApiPermissionError(error)
          ? tSettings('error_no_permission')
          : isApiConflictError(error)
            ? t('error_duplicate')
            : t('error_generic'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? t('edit_title') : t('create_title')}</DialogTitle>
            <DialogDescription>
              {isEditMode ? t('edit_description') : t('create_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label-name">
                {t('name_label')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name_placeholder')}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('color_label')}</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('color_label')}>
                {LABEL_COLOR_PALETTE.map((paletteColor) => (
                  <button
                    key={paletteColor}
                    type="button"
                    role="radio"
                    aria-checked={color === paletteColor}
                    aria-label={t('color_option', { color: paletteColor })}
                    onClick={() => setColor(paletteColor)}
                    className={cn(
                      'border-border/50 focus-visible:ring-ring h-6 w-6 rounded-md border transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      color === paletteColor && 'ring-ring ring-2 ring-offset-2'
                    )}
                    style={{ backgroundColor: paletteColor }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label-description">
                {t('description_label')}{' '}
                <span className="text-muted-foreground font-normal">
                  {t('description_optional')}
                </span>
              </Label>
              <Textarea
                id="label-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tActions('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? t('save_submit') : t('create_submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
