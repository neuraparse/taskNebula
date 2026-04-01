'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Loader2 } from 'lucide-react';
import { useUpdateIssue } from '@/lib/hooks/use-issues';
import { IssueAttachments } from './issue-attachments';
import { IssueLinks } from './issue-links';
import { IssueSubtasks } from './issue-subtasks';

interface IssueContentProps {
  issue: {
    id: string;
    projectId: string;
    description: string | null;
  };
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
    <div className="space-y-6">
      {/* Description */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</h3>
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
              <div dangerouslySetInnerHTML={{ __html: issue.description.replace(/\n/g, '<br />') }} />
            ) : (
              <p className="text-muted-foreground/60 italic">No description provided</p>
            )}
          </div>
        )}
      </section>

      {/* Subtasks */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Subtasks</h3>
        <IssueSubtasks issueId={issue.id} projectId={issue.projectId} />
      </section>

      {/* Attachments */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Attachments</h3>
        <IssueAttachments issueId={issue.id} />
      </section>

      {/* Links */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Links</h3>
        <IssueLinks issueId={issue.id} projectId={issue.projectId} />
      </section>
    </div>
  );
}
