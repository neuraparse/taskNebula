'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
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
  { name: 'Board', href: 'board', icon: LayoutGrid },
  { name: 'Backlog', href: 'backlog', icon: List },
  { name: 'Sprints', href: 'sprints', icon: Timer },
  { name: 'Docs', href: 'docs', icon: BookOpenText },
  { name: 'Chat', href: 'chat', icon: MessagesSquare },
  { name: 'Analytics', href: 'analytics', icon: BarChart3 },
  { name: 'Settings', href: 'settings', icon: Settings },
];

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = use(params);
  const pathname = usePathname();
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
  const currentTab = pathname?.split('/').pop() || 'board';
  const visibleTabs = tabs.filter((tab) => {
    if (tab.href === 'chat') {
      return permissions.canBrowseChat || currentTab === 'chat';
    }

    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Project Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="px-6 pt-3 pb-0">
          {/* Breadcrumb + Sprint */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors">
                Projects
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="font-medium text-foreground">
                {project?.name || projectId}
              </span>
              {project?.key && (
                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground ml-1">
                  {project.key}
                </span>
              )}
            </div>

            {activeSprint && (
              <Link
                href={`/projects/${projectId}/sprints/${activeSprint.id}`}
                className="flex items-center gap-2 text-xs group"
              >
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="font-medium">{activeSprint.name}</span>
                  <span className="text-emerald-600/60 dark:text-emerald-400/60">
                    {activeSprint.issueCount || 0} issues
                  </span>
                </div>
              </Link>
            )}
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-0 -mb-px">
            {visibleTabs.map((tab) => {
              const isActive = currentTab === tab.href ||
                (tab.href === 'board' && currentTab === projectId);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={`/projects/${projectId}/${tab.href}`}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
