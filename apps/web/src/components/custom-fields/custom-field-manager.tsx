'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, GripVertical, Type, Hash, Calendar, List, ToggleLeft, Link, Mail, Layers } from 'lucide-react';
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
  { label: string; icon: React.ElementType; chipClass: string }
> = {
  text: {
    label: 'Text',
    icon: Type,
    chipClass: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
  },
  number: {
    label: 'Number',
    icon: Hash,
    chipClass: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
  },
  date: {
    label: 'Date',
    icon: Calendar,
    chipClass: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
  },
  select: {
    label: 'Select',
    icon: List,
    chipClass: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20',
  },
  multi_select: {
    label: 'Multi-Select',
    icon: Layers,
    chipClass: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20',
  },
  checkbox: {
    label: 'Checkbox',
    icon: ToggleLeft,
    chipClass: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
  },
  url: {
    label: 'URL',
    icon: Link,
    chipClass: 'bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20',
  },
  email: {
    label: 'Email',
    icon: Mail,
    chipClass: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
  },
};

export function CustomFieldManager({ organizationId, projectId }: CustomFieldManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const { data, isLoading } = useCustomFields(organizationId, projectId);
  const deleteField = useDeleteCustomField();

  const customFields = data?.customFields || [];

  const handleDelete = async (fieldId: string) => {
    if (confirm('Are you sure you want to delete this custom field?')) {
      await deleteField.mutateAsync(fieldId);
    }
  };

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <span className="kicker">Custom fields</span>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="surface-card p-5 space-y-4 animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="kicker">Custom fields</span>
            <h3 className="text-sm font-semibold tracking-tight">Custom fields</h3>
            <p className="text-xs text-muted-foreground">
              Manage custom fields for {projectId ? 'this project' : 'your organization'}.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add field
          </Button>
        </div>

        {customFields.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Type className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No custom fields yet.</p>
            <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first field
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-card stagger">
            {customFields.map((field) => {
              const config =
                FIELD_TYPE_CONFIG[field.type] || {
                  label: field.type,
                  icon: Type,
                  chipClass: 'bg-muted text-muted-foreground border border-border',
                };
              const FieldIcon = config.icon;

              return (
                <div
                  key={field.id}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/40"
                >
                  <GripVertical
                    className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Drag to reorder"
                  />

                  <FieldIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{field.name}</span>
                      <span
                        className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${config.chipClass}`}
                      >
                        {config.label}
                      </span>
                      {field.isRequired && (
                        <span className="inline-flex items-center rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          Required
                        </span>
                      )}
                    </div>
                    {field.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingField(field)}
                      aria-label="Edit field"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(field.id)}
                      disabled={deleteField.isPending}
                      aria-label="Delete field"
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
