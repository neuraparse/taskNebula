'use client';

import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useCreateCustomField, useUpdateCustomField } from '@/lib/hooks/use-custom-fields';

interface EditableCustomField {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isRequired: boolean;
  options: string | null;
}

interface CreateCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  projectId?: string;
  fieldToEdit?: EditableCustomField | null;
}

export function CreateCustomFieldDialog({
  open,
  onOpenChange,
  organizationId,
  projectId,
  fieldToEdit,
}: CreateCustomFieldDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState('');

  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();

  const isEditMode = Boolean(fieldToEdit);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (fieldToEdit) {
      setName(fieldToEdit.name);
      setDescription(fieldToEdit.description || '');
      setType(fieldToEdit.type);
      setIsRequired(fieldToEdit.isRequired);
      setOptions(fieldToEdit.options || '');
      return;
    }

    setName('');
    setDescription('');
    setType('text');
    setIsRequired(false);
    setOptions('');
  }, [fieldToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (fieldToEdit) {
      await updateField.mutateAsync({
        fieldId: fieldToEdit.id,
        name,
        description: description || '',
        isRequired,
        options: options || '',
      });
    } else {
      await createField.mutateAsync({
        organizationId,
        projectId,
        name,
        description: description || undefined,
        type: type as any,
        isRequired,
        options: options || undefined,
      });
    }

    onOpenChange(false);
  };

  const showOptionsField = type === 'select' || type === 'multi_select';
  const isPending = createField.isPending || updateField.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Custom Field' : 'Create Custom Field'}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Update the field details used across your issues.'
                : 'Add a new custom field to capture additional information.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Field Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Help text shown to users filling this field"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                Field Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={setType} disabled={isEditMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                  <SelectItem value="multi_select">Multi-Select</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              {isEditMode && (
                <p className="text-xs text-muted-foreground">Field type cannot be changed after creation.</p>
              )}
            </div>

            {showOptionsField && (
              <div className="space-y-2">
                <Label htmlFor="options">
                  Options <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="options"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder={'Option 1\nOption 2\nOption 3'}
                  rows={4}
                  required={showOptionsField}
                />
                <p className="text-xs text-muted-foreground">Enter each option on a new line</p>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                id="required"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked as boolean)}
              />
              <span className="text-sm">Required field</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Field'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
