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
    <div className="space-y-4">
      {/* Description Section */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Description</h3>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>

        <div className="p-4">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateIssue.isPending}>
                  {updateIssue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={updateIssue.isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {issue.description ? (
                <div dangerouslySetInnerHTML={{ __html: issue.description.replace(/\n/g, '<br />') }} />
              ) : (
                <p className="text-muted-foreground italic">No description provided</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attachments Section */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Attachments</h3>
        </div>
        <div className="p-3">
          <IssueAttachments issueId={issue.id} />
        </div>
      </div>

      {/* Linked Issues Section */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Links</h3>
        </div>
        <div className="p-3">
          <IssueLinks issueId={issue.id} projectId={issue.projectId} />
        </div>
      </div>

      {/* Subtasks Section */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Subtasks</h3>
        </div>
        <div className="p-3">
          <IssueSubtasks issueId={issue.id} projectId={issue.projectId} />
        </div>
      </div>
    </div>
  );
}

