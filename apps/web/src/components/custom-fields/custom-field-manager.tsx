'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, GripVertical, Type, Hash, Calendar, List, ToggleLeft, Link, Mail, Layers } from 'lucide-react';
import { useCustomFields, useDeleteCustomField } from '@/lib/hooks/use-custom-fields';
import { CreateCustomFieldDialog } from './create-custom-field-dialog';

interface CustomFieldManagerProps {
  organizationId: string;
  projectId?: string;
}

// Field type icons colored via accent palette tokens
const FIELD_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; iconClass: string }> = {
  text: { label: 'Text', icon: Type, iconClass: 'text-accent-blue' },
  number: { label: 'Number', icon: Hash, iconClass: 'text-accent-emerald' },
  date: { label: 'Date', icon: Calendar, iconClass: 'text-accent-violet' },
  select: { label: 'Select', icon: List, iconClass: 'text-accent-amber' },
  multi_select: { label: 'Multi-Select', icon: Layers, iconClass: 'text-accent-rose' },
  checkbox: { label: 'Checkbox', icon: ToggleLeft, iconClass: 'text-accent-cyan' },
  url: { label: 'URL', icon: Link, iconClass: 'text-accent-indigo' },
  email: { label: 'Email', icon: Mail, iconClass: 'text-accent-cyan' },
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Fields</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Custom Fields</CardTitle>
              <CardDescription>
                Manage custom fields for {projectId ? 'this project' : 'your organization'}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customFields.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Type className="mx-auto mb-2 h-8 w-8 opacity-20" />
              <p>No custom fields yet. Create your first one to get started.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {customFields.map((field) => {
                const config = FIELD_TYPE_CONFIG[field.type] || { label: field.type, icon: Type, iconClass: 'text-muted-foreground' };
                const FieldIcon = config.icon;

                return (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-200 hover:bg-accent/50"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-move text-muted-foreground" aria-label="Drag to reorder" />

                    <FieldIcon className={`h-4 w-4 shrink-0 ${config.iconClass}`} aria-label={config.label} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{field.name}</span>
                        <span className="chip text-[10px]">{config.label}</span>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingField(field)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(field.id)}
                        disabled={deleteField.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
