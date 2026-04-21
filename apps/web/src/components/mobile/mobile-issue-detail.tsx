'use client';

import { Issue } from '@tasknebula/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  ArrowLeft,
  MoreVertical,
  User,
  Calendar,
  Tag,
  MessageSquare,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface MobileIssueDetailProps {
  issue: Issue;
  onBack?: () => void;
}

export function MobileIssueDetail({ issue, onBack }: MobileIssueDetailProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Compact header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-12 items-center justify-between px-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
            asChild={!onBack}
            aria-label="Go back"
          >
            {onBack ? (
              <ArrowLeft className="h-4 w-4" />
            ) : (
              <Link href="/board">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
          </Button>

          <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Actions</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 py-4">
                <Button variant="outline" className="w-full justify-start">
                  Edit Issue
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Assign to Me
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Change Status
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive"
                >
                  Delete Issue
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
            <p className="text-sm text-muted-foreground leading-relaxed">
              {issue.description}
            </p>
          )}

          {/* Details */}
          <div className="space-y-3 border-t border-border pt-4">
            {/* Assignee */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Assignee</span>
              <div className="ml-auto flex items-center gap-2">
                {issue.assigneeId ? (
                  <>
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-[9px]">?</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">Assigned</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
            </div>

            {/* Reporter */}
            {issue.reporterId && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Reporter</span>
                <div className="ml-auto flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-[9px]">?</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">Reporter</span>
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="ml-auto text-sm">
                {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Labels</span>
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
      <div className="border-t border-border p-3">
        <Button className="w-full">
          <MessageSquare className="mr-2 h-4 w-4" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}
