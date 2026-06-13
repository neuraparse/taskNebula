'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tag } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TEMPLATE_CATEGORIES, type WorkItemTemplate } from '@/lib/templates/registry';

const CATEGORY_LABEL: Record<WorkItemTemplate['category'], string> = TEMPLATE_CATEGORIES.reduce(
  (acc, c) => {
    acc[c.value] = c.label;
    return acc;
  },
  {} as Record<WorkItemTemplate['category'], string>
);

const TYPE_VARIANT: Record<WorkItemTemplate['type'], 'info' | 'destructive' | 'muted' | 'success'> =
  {
    story: 'info',
    bug: 'destructive',
    task: 'muted',
    epic: 'success',
  };

export interface TemplateCardProps {
  template: WorkItemTemplate;
  onUse?: (template: WorkItemTemplate) => void;
  className?: string;
}

export function TemplateCard({ template, onUse, className }: TemplateCardProps) {
  const t = useTranslations('planning');
  const handleUse = React.useCallback(() => {
    onUse?.(template);
  }, [onUse, template]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleUse();
      }
    },
    [handleUse]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleUse}
      onKeyDown={handleKeyDown}
      aria-label={t('use_template_aria', { name: template.name })}
      className={cn(
        'border-border bg-card shadow-xs ease-smooth group relative flex h-full flex-col gap-3 rounded-lg border p-4 text-left transition-all duration-200',
        'hover:border-ring focus-visible:ring-ring focus-visible:ring-offset-background hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="border-border bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-xl leading-none"
        >
          <span>{template.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground truncate text-sm font-semibold leading-snug">
            {template.name}
          </h3>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
            {template.description}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant="outline" size="sm">
            {CATEGORY_LABEL[template.category]}
          </Badge>
          <Badge variant={TYPE_VARIANT[template.type]} size="sm">
            {t(`type_${template.type}`)}
          </Badge>
          {template.labels.length > 0 ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
              <Tag className="h-3 w-3" aria-hidden="true" />
              {template.labels.length}
              <span className="sr-only">{t('labels')}</span>
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            handleUse();
          }}
        >
          {t('use_template')}
        </Button>
      </div>
    </div>
  );
}
