'use client';

import { use, useState } from 'react';
import { useIssues, useUpdateIssue } from '@/lib/hooks/use-issues';
import { useSprints, useAssignIssueToSprint } from '@/lib/hooks/use-sprints';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  List,
  MoreHorizontal,
  Timer,
  AlertCircle,
  Circle,
  ArrowUp,
  ArrowDown,
  Minus,
  BookOpen,
  CheckSquare,
  Bug,
  Zap,
  FileText,
  Loader2,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  story: { icon: BookOpen, color: 'text-emerald-500' },
  task: { icon: CheckSquare, color: 'text-blue-500' },
  bug: { icon: Bug, color: 'text-red-500' },
  epic: { icon: Zap, color: 'text-purple-500' },
};

export default function BacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

  const { data: allIssues, isLoading: issuesLoading } = useIssues({ projectId });
  const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
  const assignToSprint = useAssignIssueToSprint();

  const backlogIssues = allIssues?.filter((issue) => !issue.sprintId) || [];
  const plannedSprints = sprints?.filter((s) => s.status === 'planned') || [];
  const activeSprint = sprints?.find((s) => s.status === 'active');

  const handleAssignToSprint = async (issueId: string, sprintId: string) => {
    try {
      await assignToSprint.mutateAsync({ sprintId, issueId });
    } catch (error) {
      console.error('Failed to assign issue to sprint:', error);
    }
  };

  const handleBulkAssign = async (sprintId: string) => {
    for (const issueId of selectedIssues) {
      await handleAssignToSprint(issueId, sprintId);
    }
    setSelectedIssues([]);
  };

  const toggleIssueSelection = (issueId: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId)
        ? prev.filter((id) => id !== issueId)
        : [...prev, issueId]
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'high':
        return <ArrowUp className="h-3.5 w-3.5 text-orange-500" />;
      case 'medium':
        return <Minus className="h-3.5 w-3.5 text-yellow-500" />;
      case 'low':
        return <ArrowDown className="h-3.5 w-3.5 text-blue-500" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  if (issuesLoading || sprintsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold">Backlog</h1>
            <span className="text-xs text-muted-foreground">
              {backlogIssues.length} issue{backlogIssues.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedIssues.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    Move {selectedIssues.length} to Sprint
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {activeSprint && (
                    <DropdownMenuItem onClick={() => handleBulkAssign(activeSprint.id)}>
                      {activeSprint.name} (Active)
                    </DropdownMenuItem>
                  )}
                  {plannedSprints.map((sprint) => (
                    <DropdownMenuItem
                      key={sprint.id}
                      onClick={() => handleBulkAssign(sprint.id)}
                    >
                      {sprint.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Issue
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {backlogIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Backlog is empty</p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
              All issues are assigned to sprints
            </p>
            <Button size="sm" variant="outline" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Issue
            </Button>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="flex items-center gap-3 px-6 py-2 border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
              <div className="w-8 flex justify-center">
                <Checkbox
                  checked={selectedIssues.length === backlogIssues.length && backlogIssues.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIssues(backlogIssues.map((i) => i.id));
                    } else {
                      setSelectedIssues([]);
                    }
                  }}
                />
              </div>
              <div className="w-8" />
              <div className="w-20">Key</div>
              <div className="flex-1">Title</div>
              <div className="w-20 text-center">Type</div>
              <div className="w-20 text-center">Priority</div>
              <div className="w-16 text-center">Est.</div>
              <div className="w-44">Sprint</div>
            </div>

            {/* Rows */}
            {backlogIssues.map((issue) => {
              const tConfig = typeConfig[issue.type] || { icon: FileText, color: 'text-muted-foreground' };
              const TypeIcon = tConfig.icon;

              return (
                <div
                  key={issue.id}
                  className={cn(
                    'flex items-center gap-3 px-6 py-2.5 border-b border-border/30 hover:bg-muted/30 transition-colors group',
                    selectedIssues.includes(issue.id) && 'bg-primary/5'
                  )}
                >
                  <div className="w-8 flex justify-center">
                    <Checkbox
                      checked={selectedIssues.includes(issue.id)}
                      onCheckedChange={() => toggleIssueSelection(issue.id)}
                    />
                  </div>

                  <div className="w-8 flex justify-center">
                    {getPriorityIcon(issue.priority)}
                  </div>

                  <div className="w-20">
                    <span className="text-xs font-mono text-muted-foreground">{issue.key}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setSelectedIssueId(issue.id)}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block w-full text-left"
                    >
                      {issue.title}
                    </button>
                  </div>

                  <div className="w-20 flex justify-center">
                    <TypeIcon className={cn('h-4 w-4', tConfig.color)} />
                  </div>

                  <div className="w-20 flex justify-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 capitalize font-medium',
                        issue.priority === 'critical' && 'border-red-500/30 text-red-600 dark:text-red-400',
                        issue.priority === 'high' && 'border-orange-500/30 text-orange-600 dark:text-orange-400',
                      )}
                    >
                      {issue.priority}
                    </Badge>
                  </div>

                  <div className="w-16 text-center">
                    {issue.estimate ? (
                      <span className="text-xs text-muted-foreground">{issue.estimate}pt</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/30">-</span>
                    )}
                  </div>

                  <div className="w-44">
                    <Select
                      onValueChange={(sprintId) => handleAssignToSprint(issue.id, sprintId)}
                    >
                      <SelectTrigger className="h-7 text-xs border-dashed">
                        <SelectValue placeholder="Add to sprint..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeSprint && (
                          <SelectItem value={activeSprint.id}>
                            {activeSprint.name} (Active)
                          </SelectItem>
                        )}
                        {plannedSprints.map((sprint) => (
                          <SelectItem key={sprint.id} value={sprint.id}>
                            {sprint.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateIssueModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
      />

      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => !open && setSelectedIssueId(null)}
        />
      )}
    </div>
  );
}
