'use client';

import { useTranslations } from 'next-intl';
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
import type { CustomProperty, CustomPropertyType } from '@/lib/work-item-types/use-work-item-types';
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

type PropertyTypeI18nKey =
  | 'prop_type_text'
  | 'prop_type_number'
  | 'prop_type_dropdown'
  | 'prop_type_date'
  | 'prop_type_member'
  | 'prop_type_url'
  | 'prop_type_boolean';

interface PropertyTypeMeta {
  value: CustomPropertyType;
  i18nKey: PropertyTypeI18nKey;
  Icon: React.ComponentType<{ className?: string }>;
}

const TEXT_META: PropertyTypeMeta = { value: 'text', i18nKey: 'prop_type_text', Icon: Type };

const PROPERTY_TYPE_META: ReadonlyArray<PropertyTypeMeta> = [
  TEXT_META,
  { value: 'number', i18nKey: 'prop_type_number', Icon: Hash },
  { value: 'dropdown', i18nKey: 'prop_type_dropdown', Icon: ChevronDown },
  { value: 'date', i18nKey: 'prop_type_date', Icon: Calendar },
  { value: 'member', i18nKey: 'prop_type_member', Icon: User },
  { value: 'url', i18nKey: 'prop_type_url', Icon: LinkIcon },
  { value: 'boolean', i18nKey: 'prop_type_boolean', Icon: ToggleLeft },
];

export function CustomPropertyEditor({ property, onChange, onRemove }: CustomPropertyEditorProps) {
  const t = useTranslations('settingsProject');

  const handleNameChange = (name: string) => {
    onChange({ ...property, name });
  };

  const handleTypeChange = (value: string) => {
    const nextType = value as CustomPropertyType;
    if (nextType === property.type) return;
    const next: CustomProperty = { ...property, type: nextType };
    if (nextType === 'dropdown') {
      next.options =
        property.options && property.options.length > 0
          ? property.options
          : [t('option_n', { index: 1 })];
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
      options: [...options, t('option_n', { index: options.length + 1 })],
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

  const selectedMeta = PROPERTY_TYPE_META.find((meta) => meta.value === property.type) ?? TEXT_META;
  const SelectedIcon = selectedMeta.Icon;

  return (
    <div className="border-border bg-card/50 space-y-3 rounded-md border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`prop-name-${property.id}`} className="text-xs">
            {t('property_name_label')}
          </Label>
          <Input
            id={`prop-name-${property.id}`}
            value={property.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('property_name_placeholder')}
          />
        </div>

        <div className="space-y-1.5 sm:w-44">
          <Label className="text-xs">{t('property_type_label')}</Label>
          <Select value={property.type} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue>
                <span className="inline-flex items-center gap-2">
                  <SelectedIcon className="text-muted-foreground h-3.5 w-3.5" />
                  {t(selectedMeta.i18nKey)}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPE_META.map(({ value, i18nKey, Icon }) => (
                <SelectItem key={value} value={value}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="text-muted-foreground h-3.5 w-3.5" />
                    {t(i18nKey)}
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
          <Label htmlFor={`prop-required-${property.id}`} className="cursor-pointer text-xs">
            {t('property_required_label')}
          </Label>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={t('remove_property')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {property.type === 'dropdown' ? (
        <div className="bg-muted/40 space-y-2 rounded-md p-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
              <List className="h-3.5 w-3.5" />
              {t('options_label')}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleAddOption}
            >
              <Plus className="mr-1 h-3 w-3" />
              {t('add_option')}
            </Button>
          </div>
          <div className="space-y-1.5">
            {(property.options ?? []).map((option, index) => (
              <div key={`${property.id}-opt-${index}`} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={t('option_n', { index: index + 1 })}
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-7 w-7"
                  onClick={() => handleRemoveOption(index)}
                  aria-label={t('remove_option')}
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
