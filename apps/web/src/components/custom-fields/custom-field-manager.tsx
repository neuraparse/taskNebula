'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Type,
  Hash,
  Calendar,
  List,
  ToggleLeft,
  Link,
  Mail,
  Layers,
} from 'lucide-react';
import { useCustomFields, useDeleteCustomField } from '@/lib/hooks/use-custom-fields';
import { CreateCustomFieldDialog } from './create-custom-field-dialog';

interface CustomFieldManagerProps {
  organizationId: string;
  projectId?: string;
}

// Field type config: icon + muted chip color per type (text=blue, number=cyan,
// date=amber, select=violet, user=emerald, etc.)
const FIELD_TYPE_CONFIG: Record<
  string,
  { labelKey: string; icon: React.ElementType; chipClass: string }
> = {
  text: {
    labelKey: 'field_type_text',
    icon: Type,
    chipClass: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
  },
  number: {
    labelKey: 'field_type_number',
    icon: Hash,
    chipClass: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
  },
  date: {
    labelKey: 'field_type_date',
    icon: Calendar,
    chipClass: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
  },
  select: {
    labelKey: 'field_type_select',
    icon: List,
    chipClass: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20',
  },
  multi_select: {
    labelKey: 'field_type_multi_select',
    icon: Layers,
    chipClass: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20',
  },
  checkbox: {
    labelKey: 'field_type_checkbox',
    icon: ToggleLeft,
    chipClass: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
  },
  url: {
    labelKey: 'field_type_url',
    icon: Link,
    chipClass: 'bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20',
  },
  email: {
    labelKey: 'field_type_email',
    icon: Mail,
    chipClass: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
  },
};

export function CustomFieldManager({ organizationId, projectId }: CustomFieldManagerProps) {
  const t = useTranslations('projectConfig');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const { data, isLoading } = useCustomFields(organizationId, projectId);
  const deleteField = useDeleteCustomField();

  const customFields = data?.customFields || [];

  const handleDelete = async (fieldId: string) => {
    if (confirm(t('delete_field_confirm'))) {
      await deleteField.mutateAsync(fieldId);
    }
  };

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <span className="kicker">{t('custom_fields')}</span>
        <p className="text-muted-foreground mt-2 text-sm">{t('loading')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="surface-card animate-fade-up space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="kicker">{t('custom_fields')}</span>
            <h3 className="text-sm font-semibold tracking-tight">{t('custom_fields')}</h3>
            <p className="text-muted-foreground text-xs">
              {projectId ? t('manage_fields_project') : t('manage_fields_organization')}
            </p>
          </div>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('add_field')}
          </Button>
        </div>

        {customFields.length === 0 ? (
          <div className="space-y-2 py-10 text-center">
            <Type className="text-muted-foreground/40 mx-auto h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('no_fields')}</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('create_first_field')}
            </Button>
          </div>
        ) : (
          <div className="divide-border/60 stagger -mx-1 divide-y">
            {customFields.map((field) => {
              const config = FIELD_TYPE_CONFIG[field.type];
              const FieldIcon = config?.icon ?? Type;
              const chipClass =
                config?.chipClass ?? 'bg-muted text-muted-foreground border border-border';
              const typeLabel = config ? t(config.labelKey) : field.type;

              return (
                <div
                  key={field.id}
                  className="row-interactive group flex items-center gap-3 px-3 py-2"
                >
                  <GripVertical
                    className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t('drag_to_reorder')}
                  />

                  <FieldIcon
                    className="text-muted-foreground h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{field.name}</span>
                      <span
                        className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${chipClass}`}
                      >
                        {typeLabel}
                      </span>
                      {field.isRequired && (
                        <span className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium">
                          {t('required_chip')}
                        </span>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {field.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingField(field)}
                      aria-label={t('edit_field')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-7 w-7"
                      onClick={() => handleDelete(field.id)}
                      disabled={deleteField.isPending}
                      aria-label={t('delete_field')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateCustomFieldDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        organizationId={organizationId}
        projectId={projectId}
      />
      <CreateCustomFieldDialog
        open={Boolean(editingField)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingField(null);
          }
        }}
        organizationId={organizationId}
        projectId={projectId}
        fieldToEdit={editingField}
      />
    </>
  );
}
