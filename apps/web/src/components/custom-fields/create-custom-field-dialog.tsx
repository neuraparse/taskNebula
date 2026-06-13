'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('projectConfig');
  const tActions = useTranslations('actions');
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? t('dialog_edit_title') : t('dialog_create_title')}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? t('dialog_edit_description') : t('dialog_create_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                {t('field_name_label')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('field_name_placeholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t('description_label')}{' '}
                <span className="text-muted-foreground font-normal">{t('optional_suffix')}</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                {t('field_type_label')} <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={setType} disabled={isEditMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{t('field_type_text')}</SelectItem>
                  <SelectItem value="number">{t('field_type_number')}</SelectItem>
                  <SelectItem value="date">{t('field_type_date')}</SelectItem>
                  <SelectItem value="select">{t('field_type_select_dropdown')}</SelectItem>
                  <SelectItem value="multi_select">{t('field_type_multi_select')}</SelectItem>
                  <SelectItem value="checkbox">{t('field_type_checkbox')}</SelectItem>
                  <SelectItem value="url">{t('field_type_url')}</SelectItem>
                  <SelectItem value="email">{t('field_type_email')}</SelectItem>
                </SelectContent>
              </Select>
              {isEditMode && (
                <p className="text-muted-foreground text-xs">{t('field_type_locked')}</p>
              )}
            </div>

            {showOptionsField && (
              <div className="space-y-2">
                <Label htmlFor="options">
                  {t('options_label')} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="options"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder={t('options_placeholder')}
                  rows={4}
                  required={showOptionsField}
                />
                <p className="text-muted-foreground text-xs">{t('options_hint')}</p>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                id="required"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked as boolean)}
              />
              <span className="text-sm">{t('required_field')}</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tActions('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? t('save_changes') : t('create_field')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
