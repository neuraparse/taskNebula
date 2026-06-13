'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, Plus, Save, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ParsedCriteria } from '@tasknebula/db';

interface AdvancedSearchProps {
  onSearch: (query: string, criteria: ParsedCriteria) => void;
  onSaveFilter?: (name: string, query: string, criteria: ParsedCriteria) => void;
}

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export function AdvancedSearch({ onSearch, onSaveFilter }: AdvancedSearchProps) {
  const t = useTranslations('searchCommand');
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', field: 'assignee', operator: '=', value: '' },
  ]);
  const [jqlQuery, setJqlQuery] = useState('');
  const [showJQL, setShowJQL] = useState(false);

  const fields = [
    { value: 'assignee', label: t('fieldAssignee') },
    { value: 'reporter', label: t('fieldReporter') },
    { value: 'status', label: t('fieldStatus') },
    { value: 'priority', label: t('fieldPriority') },
    { value: 'type', label: t('fieldType') },
    { value: 'project', label: t('fieldProject') },
    { value: 'sprint', label: t('fieldSprint') },
    { value: 'labels', label: t('fieldLabels') },
    { value: 'created', label: t('fieldCreated') },
    { value: 'updated', label: t('fieldUpdated') },
  ];

  const operators = [
    { value: '=', label: t('opEquals') },
    { value: 'IN', label: t('opIn') },
    { value: 'CONTAINS', label: t('opContains') },
    { value: '>=', label: t('opAfter') },
    { value: '<=', label: t('opBefore') },
  ];

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: Date.now().toString(), field: 'assignee', operator: '=', value: '' },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const buildQuery = () => {
    const parts = conditions
      .filter((c) => c.value.trim())
      .map((c) => {
        const value = c.value.includes(' ') ? `"${c.value}"` : c.value;
        if (c.operator === 'IN') return `${c.field} IN (${value})`;
        if (c.operator === '>=') return `${c.field} >= "${value}"`;
        if (c.operator === '<=') return `${c.field} <= "${value}"`;
        if (c.operator === 'CONTAINS') return `${c.field} CONTAINS "${value}"`;
        return `${c.field} = ${value}`;
      });

    return parts.join(' AND ');
  };

  const handleSearch = () => {
    const query = showJQL ? jqlQuery : buildQuery();
    if (!query.trim()) return;

    const criteria: ParsedCriteria = {};
    conditions.forEach((c) => {
      if (c.value.trim()) criteria[c.field] = c.value;
    });

    onSearch(query, criteria);
  };

  const handleSaveFilter = () => {
    const query = showJQL ? jqlQuery : buildQuery();
    if (!query.trim()) return;

    const name = prompt(t('enterFilterName'));
    if (!name) return;

    const criteria: ParsedCriteria = {};
    conditions.forEach((c) => {
      if (c.value.trim()) criteria[c.field] = c.value;
    });

    onSaveFilter?.(name, query, criteria);
  };

  const activeFilters = conditions.filter((c) => c.value.trim());

  return (
    <div className="surface-card space-y-3 rounded-lg p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium tracking-tight">
          {showJQL ? t('jqlEditor') : t('filterBuilder')}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowJQL(!showJQL)}
            className="text-muted-foreground h-7 px-2 text-xs"
          >
            {showJQL ? t('visualBuilder') : t('jqlEditor')}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          {onSaveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveFilter}
              className="text-muted-foreground h-7 px-2 text-xs"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {t('save')}
            </Button>
          )}
          <Button onClick={handleSearch} size="sm" className="h-7 px-3 text-xs">
            <Search className="mr-1.5 h-3.5 w-3.5" />
            {t('search')}
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {!showJQL && activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilters.map((c) => (
            <span key={c.id} className="chip-accent inline-flex items-center gap-1">
              <span className="font-medium">{c.field}</span>
              <span className="text-muted-foreground">{c.operator}</span>
              <span>{c.value}</span>
              <button
                onClick={() => updateCondition(c.id, { value: '' })}
                className="ease-snap hover:text-foreground focus-visible:ring-ring ml-0.5 rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
                aria-label={t('removeFieldFilter', { field: c.field })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Builder / JQL */}
      {showJQL ? (
        <div className="space-y-2">
          <Input
            placeholder={t('jqlPlaceholder')}
            value={jqlQuery}
            onChange={(e) => setJqlQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <p className="text-muted-foreground text-xs">{t('jqlExamples')}</p>
        </div>
      ) : (
        <div className="stagger space-y-2">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="animate-fade-up flex items-center gap-2">
              {index > 0 && <span className="chip shrink-0">{'AND'}</span>}
              <Select
                value={condition.field}
                onValueChange={(value) => updateCondition(condition.id, { field: value })}
              >
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={condition.operator}
                onValueChange={(value) => updateCondition(condition.id, { operator: value })}
              >
                <SelectTrigger className="w-[110px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder={t('valuePlaceholder')}
                value={condition.value}
                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />

              {conditions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground h-8 w-8 shrink-0"
                  onClick={() => removeCondition(condition.id)}
                  aria-label={t('removeCondition')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={addCondition}
            className="text-muted-foreground h-7 px-2 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('addCondition')}
          </Button>
        </div>
      )}
    </div>
  );
}
