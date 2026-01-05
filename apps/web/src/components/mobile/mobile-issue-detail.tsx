'use client';

import { Issue } from '@tasknebula/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  Link as LinkIcon,
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
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            asChild={!onBack}
          >
            {onBack ? (
              <ArrowLeft className="h-5 w-5" />
            ) : (
              <Link href="/board">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
          </Button>

          <span className="text-sm text-muted-foreground">{issue.key}</span>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
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
        <div className="space-y-6 p-4">
          {/* Title */}
          <div>
            <h1 className="text-xl font-bold leading-tight">{issue.title}</h1>
          </div>

          {/* Status & Priority */}
          <div className="flex gap-2">
            <Badge>{issue.status}</Badge>
            <Badge variant="outline">{issue.priority}</Badge>
            {issue.type && <Badge variant="secondary">{issue.type}</Badge>}
          </div>

          {/* Description */}
          {issue.description && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground">
                {issue.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Details */}
          <div className="space-y-4">
            {/* Assignee */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Assignee</span>
              <div className="ml-auto flex items-center gap-2">
                {issue.assigneeId ? (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-xs">
                        ?
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">Assigned</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Unassigned
                  </span>
                )}
              </div>
            </div>

            {/* Reporter */}
            {issue.reporterId && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Reporter</span>
                <div className="ml-auto flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-xs">
                      ?
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">Reporter</span>
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="ml-auto text-sm">
                {formatDistanceToNow(new Date(issue.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>

            {/* Labels */}
            {issue.labels && issue.labels.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Labels</span>
                <div className="ml-auto flex flex-wrap justify-end gap-1">
                  {issue.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="border-t p-4">
        <Button className="w-full" size="lg">
          <MessageSquare className="mr-2 h-4 w-4" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}

