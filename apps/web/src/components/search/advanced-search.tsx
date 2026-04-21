'use client';

import { useState } from 'react';
import { Search, X, Plus, Save, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { criteriaToJQL, type ParsedCriteria } from '@tasknebula/db';

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
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', field: 'assignee', operator: '=', value: '' },
  ]);
  const [jqlQuery, setJqlQuery] = useState('');
  const [showJQL, setShowJQL] = useState(false);

  const fields = [
    { value: 'assignee', label: 'Assignee' },
    { value: 'reporter', label: 'Reporter' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'type', label: 'Type' },
    { value: 'project', label: 'Project' },
    { value: 'sprint', label: 'Sprint' },
    { value: 'labels', label: 'Labels' },
    { value: 'created', label: 'Created Date' },
    { value: 'updated', label: 'Updated Date' },
  ];

  const operators = [
    { value: '=', label: 'equals' },
    { value: 'IN', label: 'in' },
    { value: 'CONTAINS', label: 'contains' },
    { value: '>=', label: 'after' },
    { value: '<=', label: 'before' },
  ];

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: Date.now().toString(), field: 'assignee', operator: '=', value: '' },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(
      conditions.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const buildQuery = () => {
    const parts = conditions
      .filter(c => c.value.trim())
      .map(c => {
        const value = c.value.includes(' ') ? `"${c.value}"` : c.value;
        if (c.operator === 'IN') {
          return `${c.field} IN (${value})`;
        } else if (c.operator === '>=') {
          return `${c.field} >= "${value}"`;
        } else if (c.operator === '<=') {
          return `${c.field} <= "${value}"`;
        } else if (c.operator === 'CONTAINS') {
          return `${c.field} CONTAINS "${value}"`;
        } else {
          return `${c.field} = ${value}`;
        }
      });

    return parts.join(' AND ');
  };

  const handleSearch = () => {
    const query = showJQL ? jqlQuery : buildQuery();
    if (!query.trim()) return;

    // Parse query to criteria (simplified)
    const criteria: ParsedCriteria = {};
    conditions.forEach(c => {
      if (c.value.trim()) {
        criteria[c.field] = c.value;
      }
    });

    onSearch(query, criteria);
  };

  const handleSaveFilter = () => {
    const query = showJQL ? jqlQuery : buildQuery();
    if (!query.trim()) return;

    const name = prompt('Enter filter name:');
    if (!name) return;

    const criteria: ParsedCriteria = {};
    conditions.forEach(c => {
      if (c.value.trim()) {
        criteria[c.field] = c.value;
      }
    });

    onSaveFilter?.(name, query, criteria);
  };

  // Active filter chips for visual feedback
  const activeFilters = conditions.filter(c => c.value.trim());

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowJQL(!showJQL)}
          className="text-muted-foreground"
        >
          {showJQL ? 'Visual Builder' : 'JQL Editor'}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
        {onSaveFilter && (
          <Button variant="ghost" size="sm" onClick={handleSaveFilter} className="text-muted-foreground">
            <Save className="mr-1.5 h-4 w-4" />
            Save filter
          </Button>
        )}
        <div className="ml-auto">
          <Button onClick={handleSearch} size="sm">
            <Search className="mr-1.5 h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {!showJQL && activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilters.map(c => (
            <span
              key={c.id}
              className="chip-accent inline-flex items-center gap-1"
            >
              <span className="font-medium">{c.field}</span>
              <span className="text-muted-foreground">{c.operator}</span>
              <span>{c.value}</span>
              <button
                onClick={() => updateCondition(c.id, { value: '' })}
                className="ml-0.5 rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${c.field} filter`}
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
            placeholder="Enter JQL query (e.g., assignee = me AND status = 'In Progress')"
            value={jqlQuery}
            onChange={(e) => setJqlQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <p className="text-xs text-muted-foreground">
            Examples: assignee = me, status IN (&quot;To Do&quot;, &quot;In Progress&quot;), priority = high
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="flex items-center gap-2">
              {index > 0 && (
                <span className="chip shrink-0">AND</span>
              )}
              <Select
                value={condition.field}
                onValueChange={(value) =>
                  updateCondition(condition.id, { field: value })
                }
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
                onValueChange={(value) =>
                  updateCondition(condition.id, { operator: value })
                }
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
                placeholder="Value"
                value={condition.value}
                onChange={(e) =>
                  updateCondition(condition.id, { value: e.target.value })
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />

              {conditions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => removeCondition(condition.id)}
                  aria-label="Remove condition"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button variant="ghost" size="sm" onClick={addCondition} className="text-muted-foreground">
            <Plus className="mr-1.5 h-4 w-4" />
            Add condition
          </Button>
        </div>
      )}
    </div>
  );
}
