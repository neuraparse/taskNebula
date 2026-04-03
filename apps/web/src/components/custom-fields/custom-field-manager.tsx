'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { useCustomFields, useDeleteCustomField } from '@/lib/hooks/use-custom-fields';
import { CreateCustomFieldDialog } from './create-custom-field-dialog';

interface CustomFieldManagerProps {
  organizationId: string;
  projectId?: string;
}

export function CustomFieldManager({ organizationId, projectId }: CustomFieldManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const { data, isLoading } = useCustomFields(organizationId, projectId);
  const deleteField = useDeleteCustomField();

  const customFields = data?.customFields || [];

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Text',
      number: 'Number',
      date: 'Date',
      select: 'Select',
      multi_select: 'Multi-Select',
      checkbox: 'Checkbox',
      url: 'URL',
      email: 'Email',
    };
    return labels[type] || type;
  };

  const getFieldTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-100 text-blue-800',
      number: 'bg-green-100 text-green-800',
      date: 'bg-purple-100 text-purple-800',
      select: 'bg-yellow-100 text-yellow-800',
      multi_select: 'bg-orange-100 text-orange-800',
      checkbox: 'bg-pink-100 text-pink-800',
      url: 'bg-indigo-100 text-indigo-800',
      email: 'bg-cyan-100 text-cyan-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (fieldId: string) => {
    if (confirm('Are you sure you want to delete this custom field?')) {
      await deleteField.mutateAsync(fieldId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
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
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Manage custom fields for {projectId ? 'this project' : 'your organization'}
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customFields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No custom fields yet.</p>
              <p className="text-sm">Create your first custom field to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.name}</span>
                      <Badge className={getFieldTypeColor(field.type)}>
                        {getFieldTypeLabel(field.type)}
                      </Badge>
                      {field.isRequired && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingField(field)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(field.id)}
                      disabled={deleteField.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
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
