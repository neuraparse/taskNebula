'use client';

/**
 * Plane-style filter chip bar for issue views.
 *
 * Renders one chip per active filter (`Field: value(s)` with a close X) and a
 * trailing "+ Filter" button that opens a popover for picking field, operator
 * and values. A "Clear all" affordance appears when at least one filter is
 * active.
 */

import * as React from 'react';
import { ChevronDown, Filter, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FILTER_FIELDS,
  OPERATOR_LABELS,
  operatorsForField,
  type FilterField,
  type FilterOperator,
  type ViewFilter,
} from '@/lib/issues/view-state';

export interface ViewFilterBarProps {
  filters: ViewFilter[];
  onChange: (next: ViewFilter[]) => void;
  availableFields?: FilterField[];
  className?: string;
}

const isValueless = (op: FilterOperator) => op === 'is_empty' || op === 'is_not_empty';

function fieldByKey(fields: FilterField[], key: string): FilterField | undefined {
  return fields.find((f) => f.key === key);
}

function chipLabel(filter: ViewFilter, field: FilterField | undefined): string {
  const label = field?.label ?? filter.field;
  const opLabel = OPERATOR_LABELS[filter.op];

  if (isValueless(filter.op)) {
    return `${label} ${opLabel}`;
  }

  const display = filter.values
    .map((value) => {
      const opt = field?.options?.find((o) => o.value === value);
      return opt ? opt.label : value;
    })
    .filter(Boolean);

  if (display.length === 0) {
    return `${label} ${opLabel} …`;
  }
  if (display.length === 1) {
    return `${label} ${opLabel} ${display[0]}`;
  }
  if (display.length <= 2) {
    return `${label} ${opLabel} ${display.join(', ')}`;
  }
  return `${label} ${opLabel} ${display[0]}, ${display[1]} +${display.length - 2}`;
}

interface AddFilterPopoverProps {
  fields: FilterField[];
  existingFields: Set<string>;
  onAdd: (filter: ViewFilter) => void;
}

function AddFilterPopover({ fields, existingFields, onAdd }: AddFilterPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'field' | 'value'>('field');
  const [selectedField, setSelectedField] = React.useState<FilterField | null>(null);
  const [op, setOp] = React.useState<FilterOperator>('is');
  const [values, setValues] = React.useState<string[]>([]);
  const [freeText, setFreeText] = React.useState('');

  const reset = React.useCallback(() => {
    setStep('field');
    setSelectedField(null);
    setOp('is');
    setValues([]);
    setFreeText('');
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handlePickField = (field: FilterField) => {
    setSelectedField(field);
    setOp('is');
    setValues([]);
    setFreeText('');
    setStep('value');
  };

  const handleToggleValue = (value: string) => {
    setValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleConfirm = () => {
    if (!selectedField) return;
    const finalValues = isValueless(op)
      ? []
      : selectedField.options
        ? values
        : freeText.trim()
          ? [freeText.trim()]
          : [];
    if (!isValueless(op) && finalValues.length === 0) return;
    onAdd({ field: selectedField.key, op, values: finalValues });
    handleOpenChange(false);
  };

  const operators = operatorsForField(selectedField ?? undefined);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label="Add filter"
        >
          <Plus className="h-3 w-3" />
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {step === 'field' ? (
          <div className="flex max-h-72 flex-col">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              Filter by
            </div>
            <ul className="overflow-y-auto py-1">
              {fields.map((field) => {
                const used = existingFields.has(field.key);
                return (
                  <li key={field.key}>
                    <button
                      type="button"
                      onClick={() => handlePickField(field)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-accent/60',
                        used && 'text-muted-foreground'
                      )}
                    >
                      <span>{field.label}</span>
                      {used ? <span className="text-[10px]">in use</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <button
                type="button"
                onClick={() => setStep('field')}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <span className="text-xs font-medium">{selectedField?.label}</span>
              <span className="w-10" aria-hidden />
            </div>

            <div className="border-b border-border px-3 py-2">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Operator
              </label>
              <div className="flex flex-wrap gap-1">
                {operators.map((operator) => (
                  <button
                    key={operator}
                    type="button"
                    onClick={() => setOp(operator)}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                      op === operator
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent/60'
                    )}
                  >
                    {OPERATOR_LABELS[operator]}
                  </button>
                ))}
              </div>
            </div>

            {!isValueless(op) ? (
              <div className="max-h-56 overflow-y-auto px-3 py-2">
                {selectedField?.options?.length ? (
                  <ul className="space-y-1">
                    {selectedField.options.map((option) => {
                      const checked = values.includes(option.value);
                      return (
                        <li key={option.value}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent/60">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => handleToggleValue(option.value)}
                            />
                            <span>{option.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Input
                    autoFocus
                    value={freeText}
                    onChange={(event) => setFreeText(event.target.value)}
                    placeholder={`Value for ${selectedField?.label.toLowerCase()}`}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleConfirm}>
                Apply
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ViewFilterBar({
  filters,
  onChange,
  availableFields = DEFAULT_FILTER_FIELDS,
  className,
}: ViewFilterBarProps) {
  const existingFields = React.useMemo(
    () => new Set(filters.map((f) => f.field)),
    [filters]
  );

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const addFilter = (filter: ViewFilter) => {
    const next = filters.filter((f) => f.field !== filter.field);
    next.push(filter);
    onChange(next);
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 py-1 text-xs',
        className
      )}
      role="toolbar"
      aria-label="View filters"
    >
      <span
        className="inline-flex h-6 items-center gap-1 text-muted-foreground"
        aria-hidden
      >
        <Filter className="h-3 w-3" />
      </span>

      {filters.map((filter, index) => {
        const field = fieldByKey(availableFields, filter.field);
        return (
          <span
            key={`${filter.field}-${index}`}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card pl-2 pr-1 text-[11px] text-foreground"
          >
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            <span className="max-w-[16rem] truncate">{chipLabel(filter, field)}</span>
            <button
              type="button"
              onClick={() => removeFilter(index)}
              className="ml-0.5 inline-grid h-4 w-4 place-content-center rounded-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              aria-label={`Remove ${field?.label ?? filter.field} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      <AddFilterPopover
        fields={availableFields}
        existingFields={existingFields}
        onAdd={addFilter}
      />

      {filters.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => onChange([])}
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

export default ViewFilterBar;
