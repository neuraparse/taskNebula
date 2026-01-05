'use client';

import { use, useState } from 'react';
import { useIssues, useUpdateIssue } from '@/lib/hooks/use-issues';
import { useSprints, useAssignIssueToSprint } from '@/lib/hooks/use-sprints';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';

export default function BacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

  const { data: allIssues, isLoading: issuesLoading } = useIssues({ projectId });
  const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
  const assignToSprint = useAssignIssueToSprint();

  // Filter backlog issues (no sprint assigned)
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
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <ArrowUp className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Minus className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <ArrowDown className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (issuesLoading || sprintsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading backlog...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <List className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Backlog</h1>
              <p className="text-sm text-muted-foreground">
                {backlogIssues.length} issue{backlogIssues.length !== 1 ? 's' : ''} not in any sprint
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedIssues.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Timer className="mr-2 h-4 w-4" />
                    Add {selectedIssues.length} to Sprint
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

            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Issue
            </Button>
          </div>
        </div>

        {/* Backlog List */}
        {backlogIssues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <List className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Backlog is empty</h3>
              <p className="text-muted-foreground mb-4">
                All issues are assigned to sprints, or create new issues
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Issue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Checkbox
                  checked={selectedIssues.length === backlogIssues.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIssues(backlogIssues.map((i) => i.id));
                    } else {
                      setSelectedIssues([]);
                    }
                  }}
                />
                Select All
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {backlogIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedIssues.includes(issue.id)}
                      onCheckedChange={() => toggleIssueSelection(issue.id)}
                    />
                    
                    {getPriorityIcon(issue.priority)}
                    
                    <button
                      onClick={() => setSelectedIssueId(issue.id)}
                      className="flex-1 text-left hover:underline"
                    >
                      <span className="text-muted-foreground mr-2">{issue.key}</span>
                      <span className="font-medium">{issue.title}</span>
                    </button>

                    <Badge variant="outline" className="capitalize">
                      {issue.type}
                    </Badge>

                    {issue.estimate && (
                      <Badge variant="secondary">{issue.estimate} pts</Badge>
                    )}

                    <Select
                      onValueChange={(sprintId) => handleAssignToSprint(issue.id, sprintId)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Add to Sprint" />
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
                ))}
              </div>
            </CardContent>
          </Card>
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

