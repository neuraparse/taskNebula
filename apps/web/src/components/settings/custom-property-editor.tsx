'use client';

import { Button } from '@/components/ui/button';
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
import type {
  CustomProperty,
  CustomPropertyType,
} from '@/lib/work-item-types/use-work-item-types';
import {
  Calendar,
  ChevronDown,
  Hash,
  Link as LinkIcon,
  List,
  Plus,
  ToggleLeft,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';

interface CustomPropertyEditorProps {
  property: CustomProperty;
  onChange: (next: CustomProperty) => void;
  onRemove: () => void;
}

interface PropertyTypeMeta {
  value: CustomPropertyType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TEXT_META: PropertyTypeMeta = { value: 'text', label: 'Text', Icon: Type };

const PROPERTY_TYPE_META: ReadonlyArray<PropertyTypeMeta> = [
  TEXT_META,
  { value: 'number', label: 'Number', Icon: Hash },
  { value: 'dropdown', label: 'Dropdown', Icon: ChevronDown },
  { value: 'date', label: 'Date', Icon: Calendar },
  { value: 'member', label: 'Member', Icon: User },
  { value: 'url', label: 'URL', Icon: LinkIcon },
  { value: 'boolean', label: 'Boolean', Icon: ToggleLeft },
];

export function CustomPropertyEditor({
  property,
  onChange,
  onRemove,
}: CustomPropertyEditorProps) {
  const handleNameChange = (name: string) => {
    onChange({ ...property, name });
  };

  const handleTypeChange = (value: string) => {
    const nextType = value as CustomPropertyType;
    if (nextType === property.type) return;
    const next: CustomProperty = { ...property, type: nextType };
    if (nextType === 'dropdown') {
      next.options = property.options && property.options.length > 0 ? property.options : ['Option 1'];
    } else {
      delete next.options;
    }
    onChange(next);
  };

  const handleRequiredChange = (required: boolean) => {
    onChange({ ...property, required });
  };

  const handleAddOption = () => {
    const options = property.options ?? [];
    onChange({
      ...property,
      options: [...options, `Option ${options.length + 1}`],
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    const options = [...(property.options ?? [])];
    options[index] = value;
    onChange({ ...property, options });
  };

  const handleRemoveOption = (index: number) => {
    const options = [...(property.options ?? [])];
    options.splice(index, 1);
    onChange({ ...property, options });
  };

  const selectedMeta =
    PROPERTY_TYPE_META.find((meta) => meta.value === property.type) ?? TEXT_META;
  const SelectedIcon = selectedMeta.Icon;

  return (
    <div className="rounded-md border border-border bg-card/50 p-3 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`prop-name-${property.id}`} className="text-xs">
            Property name
          </Label>
          <Input
            id={`prop-name-${property.id}`}
            value={property.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Severity"
          />
        </div>

        <div className="sm:w-44 space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={property.type} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue>
                <span className="inline-flex items-center gap-2">
                  <SelectedIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {selectedMeta.label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPE_META.map(({ value, label, Icon }) => (
                <SelectItem key={value} value={value}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:pb-2">
          <Switch
            id={`prop-required-${property.id}`}
            checked={property.required}
            onCheckedChange={handleRequiredChange}
          />
          <Label htmlFor={`prop-required-${property.id}`} className="text-xs cursor-pointer">
            Required
          </Label>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove property"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {property.type === 'dropdown' ? (
        <div className="space-y-2 rounded-md bg-muted/40 p-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <List className="h-3.5 w-3.5" />
              Options
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleAddOption}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add option
            </Button>
          </div>
          <div className="space-y-1.5">
            {(property.options ?? []).map((option, index) => (
              <div key={`${property.id}-opt-${index}`} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveOption(index)}
                  aria-label="Remove option"
                  disabled={(property.options?.length ?? 0) <= 1}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
