'use client';

import { Issue } from '@tasknebula/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ArrowLeft, MoreVertical, User, Calendar, Tag, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface MobileIssueDetailProps {
  issue: Issue;
  onBack?: () => void;
}

export function MobileIssueDetail({ issue, onBack }: MobileIssueDetailProps) {
  const t = useTranslations('mobileNav');
  return (
    <div className="bg-background flex h-full flex-col">
      {/* Compact header */}
      <div className="border-border bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="flex h-14 items-center justify-between px-3">
          <Button
            variant="ghost"
            size="icon"
            className="ease-snap h-9 w-9 transition-all duration-150"
            onClick={onBack}
            asChild={!onBack}
            aria-label={t('goBack')}
          >
            {onBack ? (
              <ArrowLeft className="h-4 w-4" />
            ) : (
              <Link href="/board">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
          </Button>

          <span className="text-muted-foreground font-mono text-xs">{issue.key}</span>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ease-snap h-9 w-9 transition-all duration-150"
                aria-label={t('moreActions')}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>{t('actions')}</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 py-4">
                <Button variant="outline" className="w-full justify-start">
                  {t('editIssue')}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  {t('assignToMe')}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  {t('changeStatus')}
                </Button>
                <Button variant="outline" className="text-destructive w-full justify-start">
                  {t('deleteIssue')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-5 p-4">
          {/* Status + priority chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="chip-accent">{issue.status}</span>
            <span className="chip">{issue.priority}</span>
            {issue.type && <span className="chip">{issue.type}</span>}
          </div>

          {/* Title */}
          <h1 className="text-xl font-semibold leading-snug">{issue.title}</h1>

          {/* Description */}
          {issue.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{issue.description}</p>
          )}

          {/* Details */}
          <div className="border-border space-y-3 border-t pt-4">
            {/* Assignee */}
            <div className="flex items-center gap-3">
              <User className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-muted-foreground text-sm">{t('assignee')}</span>
              <div className="ml-auto flex items-center gap-2">
                {issue.assigneeId ? (
                  <>
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-[9px]">?</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{t('assigned')}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">{t('unassigned')}</span>
                )}
              </div>
            </div>

            {/* Reporter */}
            {issue.reporterId && (
              <div className="flex items-center gap-3">
                <User className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-muted-foreground text-sm">{t('reporter')}</span>
                <div className="ml-auto flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-[9px]">?</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{t('reporter')}</span>
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center gap-3">
              <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-muted-foreground text-sm">{t('created')}</span>
              <span className="ml-auto text-sm">
                {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-muted-foreground text-sm">{t('labels')}</span>
                <div className="ml-auto flex flex-wrap justify-end gap-1">
                  {issue.labels.map((label) => (
                    <span key={label} className="chip text-xs">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div className="border-border border-t p-3">
        <Button className="w-full">
          <MessageSquare className="mr-2 h-4 w-4" />
          {t('addComment')}
        </Button>
      </div>
    </div>
  );
}
