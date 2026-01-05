'use client';

import { useState } from 'react';
import { Search, X, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Advanced Search</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJQL(!showJQL)}
            >
              {showJQL ? 'Visual Builder' : 'JQL Editor'}
            </Button>
            {onSaveFilter && (
              <Button variant="outline" size="sm" onClick={handleSaveFilter}>
                <Save className="h-4 w-4 mr-2" />
                Save Filter
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showJQL ? (
          <div className="space-y-2">
            <Input
              placeholder="Enter JQL query (e.g., assignee = me AND status = 'In Progress')"
              value={jqlQuery}
              onChange={(e) => setJqlQuery(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Examples: assignee = me, status IN (&quot;To Do&quot;, &quot;In Progress&quot;), priority = high
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="flex gap-2 items-center">
                {index > 0 && (
                  <Badge variant="secondary" className="px-2">
                    AND
                  </Badge>
                )}
                <Select
                  value={condition.field}
                  onValueChange={(value) =>
                    updateCondition(condition.id, { field: value })
                  }
                >
                  <SelectTrigger className="w-[150px]">
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
                  <SelectTrigger className="w-[120px]">
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
                  className="flex-1"
                />

                {conditions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(condition.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSearch} className="flex-1">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

