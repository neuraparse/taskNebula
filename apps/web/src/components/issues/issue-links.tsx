'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useIssueLinks,
  useDeleteIssueLink,
  getLinkTypeLabel,
  type IssueLink,
} from '@/lib/hooks/use-issue-links';
import { LinkIssueDialog } from './link-issue-dialog';
import { Button } from '@/components/ui/button';
import { Link2, Plus, X, ExternalLink, Ban, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface IssueLinksProps {
  issueId: string;
  projectId: string;
}

// The relationship label as it reads from the subject issue's perspective,
// after the inbound/outbound direction has been resolved by the hook helper.
type ResolvedRelationship =
  | 'blocks'
  | 'is blocked by'
  | 'relates to'
  | 'duplicates'
  | 'is duplicated by'
  | 'is parent of'
  | 'is child of';

interface RelationshipGroup {
  relationship: ResolvedRelationship;
  links: IssueLink[];
  /** Semantic chip utility for the group header. */
  chip: string;
  /** Whether this group means the subject issue is blocked (rose cue). */
  blocked: boolean;
  /** Whether this group means the subject issue blocks others. */
  blocking: boolean;
}

// Stable display order: blocking relationships first (most actionable),
// then dependencies, relations, and duplicates.
const RELATIONSHIP_ORDER: ResolvedRelationship[] = [
  'is blocked by',
  'blocks',
  'relates to',
  'duplicates',
  'is duplicated by',
  'is parent of',
  'is child of',
];

function chipForRelationship(rel: ResolvedRelationship): string {
  switch (rel) {
    case 'is blocked by':
      return 'chip-rose';
    case 'blocks':
      return 'chip-amber';
    case 'duplicates':
    case 'is duplicated by':
      return 'chip-violet';
    case 'is parent of':
    case 'is child of':
      return 'chip-cyan';
    case 'relates to':
    default:
      return 'chip-blue';
  }
}

export function IssueLinks({ issueId, projectId }: IssueLinksProps) {
  const t = useTranslations('issueRelations');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: linksData, isLoading } = useIssueLinks(issueId);
  const deleteLink = useDeleteIssueLink();

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteLink.mutateAsync({ issueId, linkId });
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
  };

  const allLinks = useMemo(
    () => [...(linksData?.outbound ?? []), ...(linksData?.inbound ?? [])],
    [linksData]
  );

  // Group by the direction-resolved relationship so "blocks" and "is blocked
  // by" become distinct, clearly-labelled sections.
  const groups = useMemo<RelationshipGroup[]>(() => {
    const byRel = new Map<ResolvedRelationship, IssueLink[]>();
    for (const link of allLinks) {
      const rel = getLinkTypeLabel(link.type, link.direction) as ResolvedRelationship;
      const bucket = byRel.get(rel);
      if (bucket) bucket.push(link);
      else byRel.set(rel, [link]);
    }
    return RELATIONSHIP_ORDER.filter((rel) => byRel.has(rel)).map((rel) => ({
      relationship: rel,
      links: byRel.get(rel) ?? [],
      chip: chipForRelationship(rel),
      blocked: rel === 'is blocked by',
      blocking: rel === 'blocks',
    }));
  }, [allLinks]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link2 className="h-3.5 w-3.5" />
        {t('loading')}
      </div>
    );
  }

  const blockedCount = groups.find((g) => g.blocked)?.links.length ?? 0;

  return (
    <>
      <div className="animate-fade-in space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link2 className="text-muted-foreground h-3.5 w-3.5" />
            {allLinks.length > 0 && <span className="chip text-[11px]">{allLinks.length}</span>}
            {blockedCount > 0 && (
              <span className="chip-rose text-[11px]">
                <Ban className="h-3 w-3" />
                {t('blockedBadge', { count: blockedCount })}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setDialogOpen(true)}
            aria-label={t('addLink')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {allLinks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('emptyPrefix')}{' '}
            <button
              onClick={() => setDialogOpen(true)}
              className="text-primary transition-colors duration-200 hover:underline"
            >
              {t('emptyCta')}
            </button>
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.relationship} className="space-y-1">
                <div className="flex items-center gap-1.5 px-0.5">
                  <span
                    className={cn(group.chip, 'capitalize')}
                    title={group.blocked ? t('blockedHint') : undefined}
                  >
                    {group.blocked && <ShieldAlert className="h-3 w-3" />}
                    {group.blocking && <Ban className="h-3 w-3" />}
                    {getRelationshipLabel(t, group.relationship)}
                  </span>
                  <span className="text-muted-foreground text-[11px]">{group.links.length}</span>
                </div>

                {group.links.map((link) => {
                  const priorityChip =
                    link.issue.priority === 'critical'
                      ? 'chip-rose'
                      : link.issue.priority === 'high'
                        ? 'chip-amber'
                        : link.issue.priority === 'medium'
                          ? 'chip-blue'
                          : 'chip';
                  return (
                    <div
                      key={link.id}
                      className={cn(
                        'row-interactive group flex items-center justify-between gap-2 rounded-md px-2 py-1.5',
                        group.blocked &&
                          'border-l-2 border-[hsl(var(--accent-rose))] bg-[hsl(var(--accent-rose)/0.04)]'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/issues/${link.issue.id}`}
                          className="hover:text-primary ease-snap flex min-w-0 items-center gap-1.5 text-sm transition-colors duration-150"
                        >
                          <span className="chip shrink-0 rounded-sm font-mono text-[11px]">
                            {link.issue.key}
                          </span>
                          <span className="truncate">{link.issue.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        </Link>
                        <span className={cn(priorityChip, 'shrink-0 text-[11px] capitalize')}>
                          {link.issue.priority}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        onClick={() => handleDeleteLink(link.id)}
                        disabled={deleteLink.isPending}
                        aria-label={t('removeLink')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <LinkIssueDialog
        issueId={issueId}
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

// Localized label for a direction-resolved relationship.
function getRelationshipLabel(
  t: ReturnType<typeof useTranslations>,
  rel: ResolvedRelationship
): string {
  switch (rel) {
    case 'blocks':
      return t('type.blocks');
    case 'is blocked by':
      return t('type.blockedBy');
    case 'relates to':
      return t('type.relatesTo');
    case 'duplicates':
      return t('type.duplicates');
    case 'is duplicated by':
      return t('type.duplicatedBy');
    case 'is parent of':
      return t('type.parentOf');
    case 'is child of':
      return t('type.childOf');
    default:
      return rel;
  }
}
