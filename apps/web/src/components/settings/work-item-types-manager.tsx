'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CustomPropertyEditor } from '@/components/settings/custom-property-editor';
import {
  useWorkItemTypes,
  type CustomProperty,
  type WorkItemType,
} from '@/lib/work-item-types/use-work-item-types';
import { Edit3, Plus, Trash2, X } from 'lucide-react';

interface WorkItemTypesManagerProps {
  projectId: string;
}

const EMOJI_PALETTE = [
  '📖',
  '🐛',
  '📌',
  '✨',
  '🎯',
  '🔥',
  '💡',
  '🚀',
  '⚡',
  '🎨',
  '🛠',
  '💬',
  '✅',
  '🔍',
  '🐞',
  '📊',
] as const;

const COLOR_SWATCHES: ReadonlyArray<{
  value: string;
  i18nKey: 'color_blue' | 'color_red' | 'color_purple' | 'color_green' | 'color_amber';
}> = [
  { value: '#3B82F6', i18nKey: 'color_blue' },
  { value: '#EF4444', i18nKey: 'color_red' },
  { value: '#8B5CF6', i18nKey: 'color_purple' },
  { value: '#10B981', i18nKey: 'color_green' },
  { value: '#F59E0B', i18nKey: 'color_amber' },
];

export function WorkItemTypesManager({ projectId }: WorkItemTypesManagerProps) {
  const t = useTranslations('settingsProject');
  const {
    types,
    isHydrated,
    addType,
    updateType,
    removeType,
    addProperty,
    updateProperty,
    removeProperty,
  } = useWorkItemTypes(projectId);

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreateType = () => {
    const created = addType({ name: t('wit_new_type_name'), icon: '📌', color: '#64748B' });
    setEditingId(created.id);
  };

  const handleDelete = (type: WorkItemType) => {
    if (type.isDefault) return;
    const confirmed = window.confirm(t('wit_delete_confirm', { name: type.name }));
    if (!confirmed) return;
    if (editingId === type.id) setEditingId(null);
    removeType(type.id);
  };

  return (
    <section className="animate-fade-up space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <span className="kicker">{t('wit_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">{t('wit_title')}</h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t('wit_description')}</p>
        </div>
        <Button onClick={handleCreateType} size="sm" disabled={!isHydrated}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('wit_new_type')}
        </Button>
      </div>

      <div className="space-y-2">
        {types.map((type) => {
          const isEditing = editingId === type.id;
          return (
            <Card key={type.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setEditingId(isEditing ? null : type.id)}
                className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                aria-expanded={isEditing}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg"
                  style={{ backgroundColor: `${type.color}1A`, color: type.color }}
                >
                  {type.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{type.name}</span>
                    <span
                      className="border-border/50 h-3 w-3 shrink-0 rounded-sm border"
                      style={{ backgroundColor: type.color }}
                      aria-hidden
                    />
                    {type.isDefault ? <span className="chip">{t('wit_default_badge')}</span> : null}
                  </div>
                  {type.description ? (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {type.description}
                    </p>
                  ) : null}
                </div>
                <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                  {t('wit_property_count', { count: type.customProperties.length })}
                </span>
                <span
                  className="text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md"
                  aria-hidden
                >
                  <Edit3 className="h-4 w-4" />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t('wit_delete_aria', { name: type.name })}
                  aria-disabled={type.isDefault}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(type);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(type);
                    }
                  }}
                  className={`text-muted-foreground inline-flex h-8 w-8 items-center justify-center rounded-md ${
                    type.isDefault
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-destructive/10 hover:text-destructive'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              </button>

              {isEditing ? (
                <TypeEditor
                  type={type}
                  onUpdate={(patch) => updateType(type.id, patch)}
                  onAddProperty={() => addProperty(type.id)}
                  onUpdateProperty={(propertyId, next) => updateProperty(type.id, propertyId, next)}
                  onRemoveProperty={(propertyId) => removeProperty(type.id, propertyId)}
                  onClose={() => setEditingId(null)}
                />
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

interface TypeEditorProps {
  type: WorkItemType;
  onUpdate: (patch: Partial<Omit<WorkItemType, 'id'>>) => void;
  onAddProperty: () => void;
  onUpdateProperty: (propertyId: string, next: CustomProperty) => void;
  onRemoveProperty: (propertyId: string) => void;
  onClose: () => void;
}

function TypeEditor({
  type,
  onUpdate,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onClose,
}: TypeEditorProps) {
  const t = useTranslations('settingsProject');
  return (
    <div className="border-border bg-muted/20 space-y-4 border-t px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('wit_edit_type')}</h3>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-muted-foreground h-7 w-7"
          onClick={onClose}
          aria-label={t('wit_close_editor')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_auto_1fr]">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('wit_icon_label')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-12 text-lg"
                aria-label={t('wit_pick_icon')}
              >
                {type.icon}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_PALETTE.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onUpdate({ icon: emoji })}
                    className={`hover:bg-muted flex h-8 w-8 items-center justify-center rounded text-lg transition-colors ${
                      emoji === type.icon ? 'bg-muted ring-primary ring-1' : ''
                    }`}
                    aria-label={t('wit_select_emoji', { emoji })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('wit_color_label')}</Label>
          <div className="flex h-9 items-center gap-1.5">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                onClick={() => onUpdate({ color: swatch.value })}
                aria-label={t('wit_set_color', { color: t(swatch.i18nKey) })}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  type.color === swatch.value ? 'border-foreground' : 'border-border'
                }`}
                style={{ backgroundColor: swatch.value }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`type-name-${type.id}`} className="text-xs">
            {t('wit_name_label')}
          </Label>
          <Input
            id={`type-name-${type.id}`}
            value={type.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t('wit_name_placeholder')}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`type-desc-${type.id}`} className="text-xs">
          {t('wit_description_label')}
        </Label>
        <Textarea
          id={`type-desc-${type.id}`}
          value={type.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder={t('wit_description_placeholder')}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">{t('wit_custom_properties_label')}</Label>
            <p className="text-muted-foreground text-xs">
              {t('wit_custom_properties_hint', {
                type: type.name.toLowerCase() || t('wit_item_fallback'),
              })}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onAddProperty}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('wit_add_property')}
          </Button>
        </div>

        {type.customProperties.length === 0 ? (
          <div className="border-border bg-background/50 text-muted-foreground rounded-md border border-dashed py-6 text-center text-xs">
            {t('wit_no_properties')}
          </div>
        ) : (
          <div className="space-y-2">
            {type.customProperties.map((property) => (
              <CustomPropertyEditor
                key={property.id}
                property={property}
                onChange={(next) => onUpdateProperty(property.id, next)}
                onRemove={() => onRemoveProperty(property.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
