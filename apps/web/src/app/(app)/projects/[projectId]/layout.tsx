'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
  PanelsTopLeft,
  LayoutGrid,
  List,
  Timer,
  BarChart3,
  Settings,
  BookOpenText,
  MessagesSquare,
  ChevronRight,
} from 'lucide-react';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

const tabs = [
  { name: 'Views', href: 'views', icon: PanelsTopLeft },
  { name: 'Board', href: 'board', icon: LayoutGrid },
  { name: 'Backlog', href: 'backlog', icon: List },
  { name: 'Sprints', href: 'sprints', icon: Timer },
  { name: 'Docs', href: 'docs', icon: BookOpenText },
  { name: 'Chat', href: 'chat', icon: MessagesSquare },
  { name: 'Analytics', href: 'analytics', icon: BarChart3 },
  { name: 'Settings', href: 'settings', icon: Settings },
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const { permissions } = useProjectPermissions(projectId);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: sprints } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/sprints?projectId=${projectId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const activeSprint = sprints?.find((s: any) => s.status === 'active');
  const currentTab = pathname?.split('/').pop() || 'views';
  const visibleTabs = tabs.filter((tab) => {
    if (tab.href === 'chat') {
      return permissions.canBrowseChat || currentTab === 'chat';
    }
    return true;
  });

  const activeTabValue = visibleTabs.some((t) => t.href === currentTab)
    ? currentTab
    : 'views';

  const projectName = project?.name || projectId;
  const initials = getInitials(projectName);

  return (
    <div className="flex h-full flex-col">
      {/* Project Header */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 pt-4 pb-0">
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-1.5 text-sm">
            <Link
              href="/projects"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Projects
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{projectName}</span>
          </div>

          {/* Identity + right action row */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-sm font-semibold text-primary">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">
                    {projectName}
                  </h1>
                  {project?.key && (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {project.key}
                    </span>
                  )}
                </div>
                {project?.description ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
              </div>
            </div>

            {activeSprint && (
              <Link
                href={`/projects/${projectId}/sprints/${activeSprint.id}`}
                className="group flex shrink-0 items-center gap-2 text-xs"
              >
                <div className="flex items-center gap-1.5 rounded-sm bg-accent-emerald/10 px-2.5 py-1 text-accent-emerald transition-colors group-hover:bg-accent-emerald/20">
                  <span className="status-dot status-live" />
                  <span className="font-medium">{activeSprint.name}</span>
                  <span className="text-accent-emerald/60">
                    {activeSprint.issueCount || 0} issues
                  </span>
                </div>
              </Link>
            )}
          </div>

          {/* Tab Navigation (uses shared <Tabs> primitive) */}
          <Tabs
            value={activeTabValue}
            onValueChange={(value) => router.push(`/projects/${projectId}/${value}`)}
          >
            <TabsList className="gap-0" aria-label="Project sections">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.href}
                    value={tab.href}
                    className="gap-1.5 px-4 py-2.5"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.name}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
