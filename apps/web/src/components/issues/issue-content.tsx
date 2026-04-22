'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Loader2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useUpdateIssue } from '@/lib/hooks/use-issues';
import { IssueAttachments } from './issue-attachments';
import { IssueDocs } from './issue-docs';
import { IssueLinks } from './issue-links';
import { IssueSubtasks } from './issue-subtasks';
import { IssueDiscussionCard } from '@/components/chat/issue-discussion-card';

interface IssueContentProps {
  issue: {
    id: string;
    key: string;
    title: string;
    projectId: string;
    description: string | null;
    updatedAt?: string | Date | null;
    updatedBy?: { name?: string | null; email?: string | null } | null;
    updater?: { name?: string | null; email?: string | null } | null;
    reporter?: { name?: string | null; email?: string | null } | null;
  };
}

function formatRelativeTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

export function IssueContent({ issue }: IssueContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(issue.description || '');
  const updateIssue = useUpdateIssue();

  const handleSave = async () => {
    try {
      await updateIssue.mutateAsync({
        issueId: issue.id,
        data: { description },
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating description:', error);
    }
  };

  const handleCancel = () => {
    setDescription(issue.description || '');
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Description */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="kicker">Description</h3>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3 w-3" />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateIssue.isPending}>
                {updateIssue.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel} disabled={updateIssue.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed">
            {issue.description ? (
              <div className="whitespace-pre-wrap">
                {issue.description.split('\n').map((line, idx) => (
                  <p key={idx} className="min-h-[1em]">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">No description provided</p>
            )}
          </div>
        )}

        {(() => {
          const editor = issue.updatedBy ?? issue.updater ?? issue.reporter ?? null;
          const editorName = editor?.name ?? editor?.email ?? null;
          if (!issue.updatedAt || !editorName) return null;
          const relative = formatRelativeTime(issue.updatedAt);
          if (!relative) return null;
          return (
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground mt-3">
              <Clock className="h-3 w-3" />
              <span>Last edited by</span>
              <span className="font-medium text-foreground">{editorName}</span>
              <span>{relative}</span>
            </div>
          );
        })()}
      </section>

      {/* Subtasks */}
      <section>
        <h3 className="kicker mb-2">Subtasks</h3>
        <div className="surface-inset rounded-md p-3">
          <IssueSubtasks issueId={issue.id} projectId={issue.projectId} />
        </div>
      </section>

      {/* Attachments */}
      <section>
        <h3 className="kicker mb-2">Attachments</h3>
        <IssueAttachments issueId={issue.id} />
      </section>

      {/* Links */}
      <section>
        <h3 className="kicker mb-2">Links</h3>
        <IssueLinks issueId={issue.id} projectId={issue.projectId} />
      </section>

      {/* Related Docs */}
      <section>
        <h3 className="kicker mb-2">Related Docs</h3>
        <IssueDocs issueId={issue.id} issueKey={issue.key} issueTitle={issue.title} projectId={issue.projectId} />
      </section>

      {/* Discussion */}
      <section>
        <h3 className="kicker mb-2">Discussion</h3>
        <IssueDiscussionCard issueId={issue.id} projectId={issue.projectId} />
      </section>
    </div>
  );
}
