'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { 
  Inbox, 
  Search, 
  Filter, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  LayoutGrid,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Issue {
  id: string;
  key: string;
  title: string;
  priority: string;
  statusId: string;
  projectId: string;
  estimate?: number;
  status: {
    name: string;
    category: string;
    color: string;
  };
  project: {
    key: string;
    name: string;
  };
}

const categoryIcons = {
  backlog: Inbox,
  in_progress: Clock,
  in_review: AlertCircle,
  done: CheckCircle2,
  blocked: XCircle,
};

const categoryColors = {
  backlog: 'text-slate-500',
  in_progress: 'text-blue-500',
  in_review: 'text-purple-500',
  done: 'text-emerald-500',
  blocked: 'text-red-500',
};

export function MyIssuesClient() {
  const { data: session } = useSession();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: myIssues, isLoading } = useQuery<Issue[]>({
    queryKey: ['my-issues', session?.user?.id],
    queryFn: async () => {
      const response = await fetch('/api/issues/my-issues');
      if (!response.ok) throw new Error('Failed to fetch issues');
      const data = await response.json();
      return data.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const filteredIssues = myIssues?.filter((issue) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      issue.title.toLowerCase().includes(query) ||
      issue.key.toLowerCase().includes(query)
    );
  });

  // Group issues by status category
  const groupedIssues = {
    backlog: filteredIssues?.filter((i) => i.status.category === 'backlog') || [],
    in_progress: filteredIssues?.filter((i) => i.status.category === 'in_progress') || [],
    in_review: filteredIssues?.filter((i) => i.status.category === 'in_review') || [],
    done: filteredIssues?.filter((i) => i.status.category === 'done') || [],
    blocked: filteredIssues?.filter((i) => i.status.category === 'blocked') || [],
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col bg-gradient-to-br from-background via-background to-muted/20">
        {/* Modern Header */}
        <div className="border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                  <Inbox className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">My Issues</h1>
                  <p className="text-xs text-muted-foreground">
                    {filteredIssues?.length || 0} issue{filteredIssues?.length !== 1 ? 's' : ''} assigned to you
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-background/60 backdrop-blur border-muted-foreground/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!filteredIssues || filteredIssues.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Inbox className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-lg font-semibold">No Issues Found</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search' : "You don't have any issues assigned to you yet"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedIssues).map(([category, issues]) => {
                if (issues.length === 0) return null;
                const Icon = categoryIcons[category as keyof typeof categoryIcons];
                const colorClass = categoryColors[category as keyof typeof categoryColors];
                const title = category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                return (
                  <div key={category}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", colorClass)} />
                      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                      <Badge variant="secondary" className="ml-2">{issues.length}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {issues.map((issue) => (
                        <Card
                          key={issue.id}
                          className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
                          onClick={() => setSelectedIssueId(issue.id)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-muted-foreground tracking-tight">
                                    {issue.key}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                    style={{ borderColor: issue.status.color, color: issue.status.color }}
                                  >
                                    {issue.status.name}
                                  </Badge>
                                </div>
                                <CardTitle className="text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                  {issue.title}
                                </CardTitle>
                              </div>
                              <PriorityBadge priority={issue.priority} />
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <LayoutGrid className="h-3 w-3" />
                              <span className="font-medium">{issue.project.name}</span>
                              {issue.estimate && (
                                <>
                                  <span>•</span>
                                  <span>{issue.estimate} pts</span>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Issue Detail Modal */}
      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => !open && setSelectedIssueId(null)}
        />
      )}
    </>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    low: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold capitalize border",
        colors[priority as keyof typeof colors] || colors.medium
      )}
    >
      {priority}
    </Badge>
  );
}
