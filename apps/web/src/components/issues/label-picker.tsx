'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface LabelPickerProps {
  value: string[];
  onChange: (labels: string[]) => void;
  disabled?: boolean;
}

const predefinedLabels = [
  'bug',
  'feature',
  'enhancement',
  'documentation',
  'design',
  'backend',
  'frontend',
  'database',
  'security',
  'performance',
  'testing',
  'urgent',
];

export function LabelPicker({ value, onChange, disabled = false }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const handleAddLabel = (label: string) => {
    if (!value.includes(label)) {
      onChange([...value, label]);
    }
  };

  const handleRemoveLabel = (label: string) => {
    onChange(value.filter((l) => l !== label));
  };

  const handleCreateLabel = () => {
    if (newLabel.trim() && !value.includes(newLabel.trim())) {
      onChange([...value, newLabel.trim()]);
      setNewLabel('');
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected labels */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((label) => (
            <span key={label} className="chip inline-flex items-center gap-1">
              {label}
              {!disabled && (
                <button
                  onClick={() => handleRemoveLabel(label)}
                  className="ml-0.5 hover:text-destructive transition-colors duration-200"
                  aria-label={`Remove label ${label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add label button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 justify-start text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-200"
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add label
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-3">
          <div className="space-y-3">
            {/* Create new label */}
            <div className="flex gap-2">
              <Input
                placeholder="Create new label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateLabel();
                  }
                }}
              />
              <Button size="sm" onClick={handleCreateLabel}>
                Add
              </Button>
            </div>

            {/* Predefined labels */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested Labels
              </p>
              <div className="flex flex-wrap gap-1">
                {predefinedLabels
                  .filter((label) => !value.includes(label))
                  .map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="chip cursor-pointer hover:bg-accent transition-colors duration-200"
                      onClick={() => {
                        handleAddLabel(label);
                        setOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

