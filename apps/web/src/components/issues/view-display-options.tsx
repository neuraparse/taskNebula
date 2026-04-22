'use client';

/**
 * Plane-style "Display" popover.
 *
 * Lets users toggle visible properties, group by / sub-group by, sort by,
 * and a couple of view-wide flags (show empty groups, show sub-issues).
 * All state is owned by the caller; this component is purely controlled.
 */

import * as React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  DISPLAY_PROPERTY_LABELS,
  GROUP_BY_OPTIONS,
  SORT_BY_OPTIONS,
  type DisplayOptions,
  type DisplayPropertyKey,
  type GroupByKey,
  type SortByKey,
} from '@/lib/issues/view-state';

export interface ViewDisplayOptionsProps {
  options: DisplayOptions;
  onChange: (next: DisplayOptions) => void;
  className?: string;
}

const PROPERTY_ORDER: DisplayPropertyKey[] = [
  'id',
  'type',
  'priority',
  'state',
  'assignee',
  'labels',
  'due_date',
  'created_at',
  'updated_at',
  'estimate',
  'cycle',
  'module',
];

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="border-b border-border px-3 py-2 last:border-b-0">
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

interface RadioRowProps<T extends string> {
  name: string;
  value: T;
  current: T;
  label: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}

function RadioRow<T extends string>({
  name,
  value,
  current,
  label,
  disabled,
  onChange,
}: RadioRowProps<T>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent/60',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="h-3.5 w-3.5 cursor-pointer accent-primary disabled:cursor-not-allowed"
      />
      <span>{label}</span>
    </label>
  );
}

export function ViewDisplayOptions({
  options,
  onChange,
  className,
}: ViewDisplayOptionsProps) {
  const update = <K extends keyof DisplayOptions>(key: K, value: DisplayOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  const toggleProperty = (key: DisplayPropertyKey) => {
    onChange({
      ...options,
      properties: { ...options.properties, [key]: !options.properties[key] },
    });
  };

  const handleGroupBy = (value: GroupByKey) => {
    const next: DisplayOptions = { ...options, groupBy: value };
    if (value === 'none') {
      next.subGroupBy = 'none';
    } else if (options.subGroupBy === value) {
      next.subGroupBy = 'none';
    }
    onChange(next);
  };

  const subGroupDisabled = options.groupBy === 'none';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-7 gap-1 px-2 text-xs', className)}
          aria-label="Display options"
        >
          <SlidersHorizontal className="h-3 w-3" />
          Display
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="max-h-[28rem] overflow-y-auto">
          <Section title="Properties">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {PROPERTY_ORDER.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent/60"
                >
                  <Checkbox
                    checked={options.properties[key]}
                    onCheckedChange={() => toggleProperty(key)}
                  />
                  <span>{DISPLAY_PROPERTY_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Group by">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {GROUP_BY_OPTIONS.map((opt) => (
                <RadioRow
                  key={opt.value}
                  name="display-group-by"
                  value={opt.value}
                  current={options.groupBy}
                  label={opt.label}
                  onChange={handleGroupBy}
                />
              ))}
            </div>
          </Section>

          <Section title="Sub-group by">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {GROUP_BY_OPTIONS.map((opt) => {
                const disabled =
                  subGroupDisabled || (opt.value !== 'none' && opt.value === options.groupBy);
                return (
                  <RadioRow
                    key={opt.value}
                    name="display-sub-group-by"
                    value={opt.value}
                    current={options.subGroupBy}
                    label={opt.label}
                    disabled={disabled}
                    onChange={(value) => update('subGroupBy', value)}
                  />
                );
              })}
            </div>
          </Section>

          <Section title="Sort by">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {SORT_BY_OPTIONS.map((opt) => (
                <RadioRow<SortByKey>
                  key={opt.value}
                  name="display-sort-by"
                  value={opt.value}
                  current={options.sortBy}
                  label={opt.label}
                  onChange={(value) => update('sortBy', value)}
                />
              ))}
            </div>
          </Section>

          <Section title="View options">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between gap-2 px-1 py-0.5 text-xs">
                <span>Show empty groups</span>
                <Switch
                  checked={options.showEmptyGroups}
                  onCheckedChange={(checked) => update('showEmptyGroups', Boolean(checked))}
                  disabled={options.groupBy === 'none'}
                  aria-label="Show empty groups"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 px-1 py-0.5 text-xs">
                <span>Show sub-issues</span>
                <Switch
                  checked={options.showSubIssues}
                  onCheckedChange={(checked) => update('showSubIssues', Boolean(checked))}
                  aria-label="Show sub-issues"
                />
              </label>
            </div>
          </Section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ViewDisplayOptions;
