'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Clock, Hash, Plus, Tag, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  PRESET_SCALES,
  SUBKINDS_BY_KIND,
  SUBKIND_LABELS,
  isCustomSubKind,
  kindOfSubKind,
  makeCustomScale,
  type EstimateKind,
  type EstimateScale,
  type EstimateSubKind,
} from '@/lib/estimates/scales';

export interface EstimateScalePickerProps {
  initialScale?: EstimateScale;
  onSave?: (scale: EstimateScale) => void;
  className?: string;
}

const KIND_TABS: Array<{
  kind: EstimateKind;
  i18nKey: 'estimate_kind_points' | 'estimate_kind_categories' | 'estimate_kind_time';
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { kind: 'points', i18nKey: 'estimate_kind_points', Icon: Hash },
  { kind: 'categories', i18nKey: 'estimate_kind_categories', Icon: Tag },
  { kind: 'time', i18nKey: 'estimate_kind_time', Icon: Clock },
];

const DEFAULT_SUBKIND: EstimateSubKind = 'points-fibonacci';
const MIN_CUSTOM_ROWS = 2;
const MAX_CUSTOM_ROWS = 32;

function defaultCustomValues(kind: EstimateKind): string[] {
  switch (kind) {
    case 'points':
      return ['1', '2', '3'];
    case 'categories':
      return ['Small', 'Medium', 'Large'];
    case 'time':
      return ['30m', '1h', '2h'];
  }
}

/**
 * Plane-style estimate scale picker for project settings.
 *
 * Exposes three tabs (Points / Categories / Time); each tab lists the
 * built-in preset scales plus a Custom row. When Custom is selected the
 * user can author the values inline.
 */
export function EstimateScalePicker({ initialScale, onSave, className }: EstimateScalePickerProps) {
  const t = useTranslations('settingsProject');
  const initialSubKind: EstimateSubKind = initialScale?.subKind ?? DEFAULT_SUBKIND;
  const initialKind: EstimateKind = kindOfSubKind(initialSubKind);

  const [activeTab, setActiveTab] = React.useState<EstimateKind>(initialKind);
  const [selected, setSelected] = React.useState<EstimateSubKind>(initialSubKind);
  const [customValues, setCustomValues] = React.useState<Record<EstimateKind, string[]>>(() => ({
    points:
      initialScale && initialScale.subKind === 'points-custom'
        ? [...initialScale.values]
        : defaultCustomValues('points'),
    categories:
      initialScale && initialScale.subKind === 'categories-custom'
        ? [...initialScale.values]
        : defaultCustomValues('categories'),
    time:
      initialScale && initialScale.subKind === 'time-custom'
        ? [...initialScale.values]
        : defaultCustomValues('time'),
  }));

  const handleTabChange = React.useCallback((value: string) => {
    const next = value as EstimateKind;
    setActiveTab(next);
    // When switching tabs, snap selection to the first preset of that kind for discoverability.
    const firstPreset = SUBKINDS_BY_KIND[next].find((sk) => !isCustomSubKind(sk));
    if (firstPreset) setSelected(firstPreset);
  }, []);

  const updateCustomValue = React.useCallback(
    (kind: EstimateKind, index: number, value: string) => {
      setCustomValues((prev) => {
        const next = [...prev[kind]];
        next[index] = value;
        return { ...prev, [kind]: next };
      });
    },
    []
  );

  const addCustomRow = React.useCallback((kind: EstimateKind) => {
    setCustomValues((prev) => {
      if (prev[kind].length >= MAX_CUSTOM_ROWS) return prev;
      return { ...prev, [kind]: [...prev[kind], ''] };
    });
  }, []);

  const removeCustomRow = React.useCallback((kind: EstimateKind, index: number) => {
    setCustomValues((prev) => {
      if (prev[kind].length <= MIN_CUSTOM_ROWS) return prev;
      const next = prev[kind].filter((_, i) => i !== index);
      return { ...prev, [kind]: next };
    });
  }, []);

  const computeSelectedScale = React.useCallback((): EstimateScale | null => {
    if (isCustomSubKind(selected)) {
      const kind = kindOfSubKind(selected);
      const cleaned = customValues[kind].map((v) => v.trim()).filter((v) => v.length > 0);
      if (cleaned.length < MIN_CUSTOM_ROWS) return null;
      return makeCustomScale(kind, cleaned);
    }
    return PRESET_SCALES[selected];
  }, [customValues, selected]);

  const canSave = computeSelectedScale() !== null;

  const handleSave = React.useCallback(() => {
    const scale = computeSelectedScale();
    if (!scale) return;
    if (onSave) onSave(scale);
    else console.info('[EstimateScalePicker] save', scale);
  }, [computeSelectedScale, onSave]);

  const handleReset = React.useCallback(() => {
    const resetSubKind: EstimateSubKind = initialScale?.subKind ?? DEFAULT_SUBKIND;
    const resetKind = kindOfSubKind(resetSubKind);
    setActiveTab(resetKind);
    setSelected(resetSubKind);
    setCustomValues({
      points:
        initialScale && initialScale.subKind === 'points-custom'
          ? [...initialScale.values]
          : defaultCustomValues('points'),
      categories:
        initialScale && initialScale.subKind === 'categories-custom'
          ? [...initialScale.values]
          : defaultCustomValues('categories'),
      time:
        initialScale && initialScale.subKind === 'time-custom'
          ? [...initialScale.values]
          : defaultCustomValues('time'),
    });
  }, [initialScale]);

  return (
    <div
      className={cn(
        'border-border bg-surface flex flex-col gap-4 rounded-md border p-4',
        className
      )}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start">
          {KIND_TABS.map(({ kind, i18nKey, Icon }) => (
            <TabsTrigger key={kind} value={kind} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(i18nKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {KIND_TABS.map(({ kind, i18nKey }) => (
          <TabsContent key={kind} value={kind} className="mt-3">
            <RadioGroupPrimitive.Root
              value={selected}
              onValueChange={(v) => setSelected(v as EstimateSubKind)}
              className="flex flex-col gap-2"
              aria-label={t('estimate_scales_group', { kind: t(i18nKey) })}
            >
              {SUBKINDS_BY_KIND[kind].map((subKind) => {
                const preset = PRESET_SCALES[subKind];
                const isCustom = isCustomSubKind(subKind);
                const isSelected = selected === subKind;
                return (
                  <div
                    key={subKind}
                    className={cn(
                      'border-border bg-background flex flex-col gap-2 rounded-md border p-3 transition-colors',
                      isSelected && 'border-primary/40 ring-primary/20 ring-1'
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <RadioGroupPrimitive.Item
                        value={subKind}
                        id={`estimate-${subKind}`}
                        className="border-border bg-background focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:border-primary mt-0.5 h-4 w-4 shrink-0 rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        <RadioGroupPrimitive.Indicator className="after:bg-primary flex items-center justify-center after:block after:h-2 after:w-2 after:rounded-full" />
                      </RadioGroupPrimitive.Item>
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground text-sm font-medium">
                          {SUBKIND_LABELS[subKind]}
                        </div>
                        {preset ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {preset.values.map((v, idx) => (
                              <Badge key={`${subKind}-${idx}-${v}`} variant="muted" size="sm">
                                {v}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground mt-0.5 text-xs">
                            {t('estimate_custom_hint')}
                          </div>
                        )}
                      </div>
                    </label>

                    {isCustom && isSelected ? (
                      <div className="flex flex-col gap-2 pl-7">
                        {customValues[kind].map((value, index) => (
                          <div key={`${kind}-custom-${index}`} className="flex items-center gap-2">
                            <Input
                              value={value}
                              onChange={(e) => updateCustomValue(kind, index, e.target.value)}
                              placeholder={t('estimate_value_placeholder', { index: index + 1 })}
                              aria-label={t('estimate_custom_value_aria', {
                                kind: t(i18nKey),
                                index: index + 1,
                              })}
                              className="h-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCustomRow(kind, index)}
                              disabled={customValues[kind].length <= MIN_CUSTOM_ROWS}
                              aria-label={t('estimate_remove_value', { index: index + 1 })}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCustomRow(kind)}
                          disabled={customValues[kind].length >= MAX_CUSTOM_ROWS}
                          className="gap-1.5 self-start"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          {t('estimate_add_value')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </RadioGroupPrimitive.Root>
          </TabsContent>
        ))}
      </Tabs>

      <div className="border-border flex items-center justify-between border-t pt-3">
        <button
          type="button"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2"
        >
          {t('estimate_reset')}
        </button>
        <Button type="button" onClick={handleSave} disabled={!canSave} size="sm">
          {t('estimate_save_scale')}
        </Button>
      </div>
    </div>
  );
}

export default EstimateScalePicker;
