'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Pencil, Loader2, Clock } from 'lucide-react';
import { useUpdateIssue } from '@/lib/hooks/use-issues';
import { IssueAttachments } from './issue-attachments';
import { IssueDocs } from './issue-docs';
import { IssueLinks } from './issue-links';
import { IssueSubtasks } from './issue-subtasks';
import { IssueDiscussionCard } from '@/components/chat/issue-discussion-card';
import { CollabDescriptionEditor } from './collab-description-editor';
import { RichDescription } from './rich-description';

// Feature flag for the Tiptap + Yjs collaborative editor. When `false` (the
// default) we render the legacy textarea; when `true` we mount the live
// editor wired to the Hocuspocus server. See `services/hocuspocus/README.md`
// for the matching server configuration.
const COLLAB_ENABLED =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true';

interface IssueContentProps {
  issue: {
    id: string;
    key: string;
    title: string;
    projectId: string;
    description: string | null;
    descriptionRich?: Record<string, unknown> | null;
    updatedAt?: string | Date | null;
    updatedBy?: { name?: string | null; email?: string | null } | null;
    updater?: { name?: string | null; email?: string | null } | null;
    reporter?: { name?: string | null; email?: string | null } | null;
  };
}

export function IssueContent({ issue }: IssueContentProps) {
  const t = useTranslations('issuePanels');
  const tActions = useTranslations('actions');
  const formatter = useFormatter();
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
    <div className="animate-fade-up space-y-6">
      {/* Description */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="kicker">{t('content.description')}</h3>
          {!isEditing && !COLLAB_ENABLED && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-6 px-2 text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3 w-3" />
              {t('content.edit')}
            </Button>
          )}
        </div>

        {COLLAB_ENABLED ? (
          <CollabDescriptionEditor
            issueId={issue.id}
            initialContent={issue.description || ''}
            canEdit
            isSaving={updateIssue.isPending}
            onSave={async (next) => {
              // The collab editor now hands back `{ plain, rich }` so we
              // persist both halves. The legacy string shape is still
              // accepted for callers that haven't migrated.
              const data =
                typeof next === 'string'
                  ? { description: next }
                  : { description: next.plain, descriptionRich: next.rich };
              try {
                await updateIssue.mutateAsync({ issueId: issue.id, data });
              } catch (error) {
                console.error('Error saving collaborative description:', error);
              }
            }}
          />
        ) : isEditing ? (
          <div className="space-y-2">
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[160px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('content.description_placeholder')}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={updateIssue.isPending}
              >
                {updateIssue.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                {tActions('save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={handleCancel}
                disabled={updateIssue.isPending}
              >
                {tActions('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            {issue.descriptionRich ? (
              // Prefer the rich snapshot the collab editor wrote to
              // `description_rich` — lists, bold, links round-trip even
              // without a live Hocuspocus client. Falls back to plain
              // text when the rich snapshot is missing.
              <RichDescription doc={issue.descriptionRich} />
            ) : issue.description ? (
              <div className="whitespace-pre-wrap">
                {issue.description.split('\n').map((line, idx) => (
                  <p key={idx} className="min-h-[1em]">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">{t('content.no_description')}</p>
            )}
          </div>
        )}

        {(() => {
          const editor = issue.updatedBy ?? issue.updater ?? issue.reporter ?? null;
          const editorName = editor?.name ?? editor?.email ?? null;
          if (!issue.updatedAt || !editorName) return null;
          const updatedAt =
            typeof issue.updatedAt === 'string' ? new Date(issue.updatedAt) : issue.updatedAt;
          const relative = Number.isNaN(updatedAt.getTime())
            ? ''
            : formatter.relativeTime(updatedAt);
          if (!relative) return null;
          return (
            <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[11.5px]">
              <Clock className="h-3 w-3" />
              <span>{t('content.last_edited_by')}</span>
              <span className="text-foreground font-medium">{editorName}</span>
              <span>{relative}</span>
            </div>
          );
        })()}
      </section>

      {/* Subtasks */}
      <section>
        <h3 className="kicker mb-2">{t('content.subtasks')}</h3>
        <div className="surface-inset rounded-md p-3">
          <IssueSubtasks issueId={issue.id} projectId={issue.projectId} />
        </div>
      </section>

      {/* Attachments */}
      <section>
        <h3 className="kicker mb-2">{t('content.attachments')}</h3>
        <IssueAttachments issueId={issue.id} />
      </section>

      {/* Links */}
      <section>
        <h3 className="kicker mb-2">{t('content.links')}</h3>
        <IssueLinks issueId={issue.id} projectId={issue.projectId} />
      </section>

      {/* Related Docs */}
      <section>
        <h3 className="kicker mb-2">{t('content.related_docs')}</h3>
        <IssueDocs
          issueId={issue.id}
          issueKey={issue.key}
          issueTitle={issue.title}
          projectId={issue.projectId}
        />
      </section>

      {/* Discussion */}
      <section>
        <h3 className="kicker mb-2">{t('content.discussion')}</h3>
        <IssueDiscussionCard issueId={issue.id} projectId={issue.projectId} />
      </section>
    </div>
  );
}
