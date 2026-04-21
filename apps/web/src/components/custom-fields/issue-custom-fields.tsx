'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomFieldValues, useSetCustomFieldValue } from '@/lib/hooks/use-custom-fields';
import { Loader2 } from 'lucide-react';

interface IssueCustomFieldsProps {
  issueId: string;
}

export function IssueCustomFields({ issueId }: IssueCustomFieldsProps) {
  const { data, isLoading } = useCustomFieldValues(issueId);
  const setFieldValue = useSetCustomFieldValue(issueId);
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());

  const customFieldValues = data?.customFieldValues || [];

  const handleValueChange = async (customFieldId: string, value: string | null) => {
    setPendingFields((prev) => new Set(prev).add(customFieldId));
    try {
      await setFieldValue.mutateAsync({ customFieldId, value });
    } finally {
      setPendingFields((prev) => {
        const next = new Set(prev);
        next.delete(customFieldId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (customFieldValues.length === 0) {
    return null;
  }

  const renderFieldInput = (fieldValue: any) => {
    const { field, value, customFieldId } = fieldValue;
    const isPending = pendingFields.has(customFieldId);

    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => handleValueChange(customFieldId, e.target.value)}
            disabled={isPending}
            placeholder={`Enter ${field.name.toLowerCase()}`}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleValueChange(customFieldId, e.target.value)}
            disabled={isPending}
            placeholder={`Enter ${field.name.toLowerCase()}`}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => handleValueChange(customFieldId, e.target.value)}
            disabled={isPending}
          />
        );

      case 'checkbox':
        return (
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={value === 'true'}
              onCheckedChange={(checked) =>
                handleValueChange(customFieldId, checked ? 'true' : 'false')
              }
              disabled={isPending}
            />
            <span className="text-sm text-muted-foreground">
              {value === 'true' ? 'Yes' : 'No'}
            </span>
          </label>
        );

      case 'select': {
        const options = field.options ? JSON.parse(field.options) : [];
        return (
          <Select
            value={value || ''}
            onValueChange={(val) => handleValueChange(customFieldId, val)}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'multi_select':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleValueChange(customFieldId, e.target.value)}
            disabled={isPending}
            placeholder="Enter values separated by commas"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 animate-fade-up">
      <span className="kicker">Custom fields</span>
      <div className="space-y-3 stagger">
        {customFieldValues.map((fieldValue) => (
          <div key={fieldValue.customFieldId} className="space-y-1.5">
            <Label className="text-xs">
              {fieldValue.field.name}
              {fieldValue.field.isRequired && (
                <span className="ml-1 text-destructive" aria-label="required">*</span>
              )}
            </Label>
            {fieldValue.field.description && (
              <p className="text-xs text-muted-foreground">{fieldValue.field.description}</p>
            )}
            {renderFieldInput(fieldValue)}
          </div>
        ))}
      </div>
    </div>
  );
}
