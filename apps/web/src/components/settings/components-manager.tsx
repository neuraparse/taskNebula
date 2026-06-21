'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  isApiBadRequestError,
  isApiConflictError,
  isApiPermissionError,
  throwApiResponseError,
} from '@/lib/client-api-errors';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationMembers, type OrganizationMember } from '@/lib/hooks/use-members';
import { cn } from '@/lib/utils';

type DefaultAssigneeType = 'project_default' | 'component_lead' | 'unassigned';

export interface ProjectComponent {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  leadId: string | null;
  defaultAssigneeType: DefaultAssigneeType;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  issueCount: number;
}

interface ComponentsResponse {
  components: ProjectComponent[];
  total: number;
}

const DEFAULT_ASSIGNEE_TYPES: ReadonlyArray<{
  value: DefaultAssigneeType;
  i18nKey: 'assignee_project_default' | 'assignee_component_lead' | 'assignee_unassigned';
}> = [
  { value: 'project_default', i18nKey: 'assignee_project_default' },
  { value: 'component_lead', i18nKey: 'assignee_component_lead' },
  { value: 'unassigned', i18nKey: 'assignee_unassigned' },
];

function useProjectComponents(projectId: string) {
  return useQuery({
    queryKey: ['project-components', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/components`);
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as ComponentsResponse;
    },
    enabled: Boolean(projectId),
  });
}

interface ComponentPayload {
  name?: string;
  description?: string | null;
  leadId?: string | null;
  defaultAssigneeType?: DefaultAssigneeType;
  archived?: boolean;
}

function useCreateComponent(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ComponentPayload & { name: string }) => {
      const response = await fetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as { component: ProjectComponent };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
    },
  });
}

function useUpdateComponent(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ componentId, ...data }: ComponentPayload & { componentId: string }) => {
      const response = await fetch(`/api/projects/${projectId}/components/${componentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as { component: ProjectComponent };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
    },
  });
}

function useDeleteComponent(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (componentId: string) => {
      const response = await fetch(`/api/projects/${projectId}/components/${componentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) await throwApiResponseError(response);
      return (await response.json()) as { success: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
    },
  });
}

function memberInitials(member: OrganizationMember): string {
  const source = member.name || member.email || '?';
  return source
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export interface ComponentsManagerProps {
  projectId: string;
}

export function ComponentsManager({ projectId }: ComponentsManagerProps) {
  const t = useTranslations('settings.components');
  const tSettings = useTranslations('settings');
  const tActions = useTranslations('actions');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { currentOrganizationId } = useOrganization();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ProjectComponent | null>(null);
  const [deletingComponent, setDeletingComponent] = useState<ProjectComponent | null>(null);

  const { data, isLoading } = useProjectComponents(projectId);
  const { data: membersData } = useOrganizationMembers(currentOrganizationId);
  const updateComponent = useUpdateComponent(projectId);
  const deleteComponent = useDeleteComponent(projectId);

  const componentList = data?.components ?? [];
  const members = useMemo(() => membersData?.members ?? [], [membersData]);
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const handleInlineUpdate = async (
    component: ProjectComponent,
    payload: ComponentPayload,
    successTitle: string
  ) => {
    try {
      await updateComponent.mutateAsync({ componentId: component.id, ...payload });
      toast({ title: successTitle, variant: 'success' });
    } catch (error) {
      toast({
        title: isApiPermissionError(error) ? tSettings('error_no_permission') : t('error_generic'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingComponent) return;
    try {
      await deleteComponent.mutateAsync(deletingComponent.id);
      toast({ title: t('toast_deleted'), variant: 'success' });
      setDeletingComponent(null);
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
            {t('new_component')}
          </Button>
        </div>

        {componentList.length === 0 ? (
          <div className="space-y-2 py-10 text-center">
            <Boxes className="text-muted-foreground/40 mx-auto h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('create_first')}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="border-border text-muted-foreground grid grid-cols-[minmax(0,1fr)_160px_170px_60px_70px_72px] items-center gap-3 border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide">
                <span>{t('col_name')}</span>
                <span>{t('col_lead')}</span>
                <span>{t('col_default_assignee')}</span>
                <span className="text-right">{t('col_issues')}</span>
                <span className="text-center">{t('col_archived')}</span>
                <span aria-hidden="true" />
              </div>

              <div className="stagger divide-border/60 divide-y">
                {componentList.map((component) => {
                  const lead = component.leadId ? membersById.get(component.leadId) : undefined;

                  return (
                    <div
                      key={component.id}
                      className={cn(
                        'row-interactive group grid grid-cols-[minmax(0,1fr)_160px_170px_60px_70px_72px] items-center gap-3 px-3 py-2',
                        component.archived && 'opacity-60'
                      )}
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium">{component.name}</span>
                        {component.description && (
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {component.description}
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        {lead ? (
                          <>
                            <Avatar size="md">
                              <AvatarImage src={lead.image ?? undefined} alt="" />
                              <AvatarFallback>{memberInitials(lead)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs">{lead.name || lead.email}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">{t('lead_none')}</span>
                        )}
                      </div>

                      <Select
                        value={component.defaultAssigneeType}
                        onValueChange={(value) =>
                          handleInlineUpdate(
                            component,
                            { defaultAssigneeType: value as DefaultAssigneeType },
                            t('toast_updated')
                          )
                        }
                      >
                        <SelectTrigger
                          className="h-7 text-xs"
                          aria-label={t('default_assignee_label')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEFAULT_ASSIGNEE_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.i18nKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-muted-foreground text-right text-xs tabular-nums">
                        {component.issueCount}
                      </span>

                      <div className="flex justify-center">
                        <Switch
                          checked={component.archived}
                          onCheckedChange={(checked) =>
                            handleInlineUpdate(
                              component,
                              { archived: checked },
                              checked ? t('toast_archived') : t('toast_restored')
                            )
                          }
                          aria-label={t('archived_toggle', { name: component.name })}
                        />
                      </div>

                      <div className="flex shrink-0 items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingComponent(component)}
                          aria-label={t('edit_title')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          onClick={() => setDeletingComponent(component)}
                          aria-label={t('delete_submit')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <ComponentEditorDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        projectId={projectId}
        members={members}
      />
      <ComponentEditorDialog
        open={Boolean(editingComponent)}
        onOpenChange={(open) => {
          if (!open) setEditingComponent(null);
        }}
        projectId={projectId}
        members={members}
        componentToEdit={editingComponent}
      />

      <Dialog
        open={Boolean(deletingComponent)}
        onOpenChange={(open) => {
          if (!open) setDeletingComponent(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('delete_title')}</DialogTitle>
            <DialogDescription>
              {t('delete_warning', { name: deletingComponent?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingComponent(null)}>
              {tActions('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteComponent.isPending}
            >
              {deleteComponent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete_submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ComponentEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  members: OrganizationMember[];
  componentToEdit?: ProjectComponent | null;
}

function ComponentEditorDialog({
  open,
  onOpenChange,
  projectId,
  members,
  componentToEdit,
}: ComponentEditorDialogProps) {
  const t = useTranslations('settings.components');
  const tSettings = useTranslations('settings');
  const tActions = useTranslations('actions');
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leadId, setLeadId] = useState<string>('none');
  const [defaultAssigneeType, setDefaultAssigneeType] =
    useState<DefaultAssigneeType>('project_default');

  const createComponent = useCreateComponent(projectId);
  const updateComponent = useUpdateComponent(projectId);

  const isEditMode = Boolean(componentToEdit);
  const isPending = createComponent.isPending || updateComponent.isPending;

  useEffect(() => {
    if (!open) return;

    if (componentToEdit) {
      setName(componentToEdit.name);
      setDescription(componentToEdit.description ?? '');
      setLeadId(componentToEdit.leadId ?? 'none');
      setDefaultAssigneeType(componentToEdit.defaultAssigneeType);
      return;
    }

    setName('');
    setDescription('');
    setLeadId('none');
    setDefaultAssigneeType('project_default');
  }, [componentToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const payload = {
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      leadId: leadId !== 'none' ? leadId : null,
      defaultAssigneeType,
    };

    try {
      if (componentToEdit) {
        await updateComponent.mutateAsync({ componentId: componentToEdit.id, ...payload });
        toast({ title: t('toast_updated'), variant: 'success' });
      } else {
        await createComponent.mutateAsync(payload);
        toast({ title: t('toast_created'), variant: 'success' });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: isApiPermissionError(error)
          ? tSettings('error_no_permission')
          : isApiConflictError(error)
            ? t('error_duplicate')
            : isApiBadRequestError(error)
              ? t('error_lead')
              : t('error_generic'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? t('edit_title') : t('create_title')}</DialogTitle>
            <DialogDescription>
              {isEditMode ? t('edit_description') : t('create_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="component-name">
                {t('name_label')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="component-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name_placeholder')}
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="component-description">
                {t('description_label')}{' '}
                <span className="text-muted-foreground font-normal">
                  {t('description_optional')}
                </span>
              </Label>
              <Textarea
                id="component-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="component-lead">{t('lead_label')}</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger id="component-lead">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('lead_none')}</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email || member.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="component-default-assignee">{t('default_assignee_label')}</Label>
              <Select
                value={defaultAssigneeType}
                onValueChange={(value) => setDefaultAssigneeType(value as DefaultAssigneeType)}
              >
                <SelectTrigger id="component-default-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_ASSIGNEE_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.i18nKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
