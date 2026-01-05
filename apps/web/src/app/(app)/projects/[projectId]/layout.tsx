'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid,
  List,
  Timer,
  BarChart3,
  Settings,
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
  { name: 'Analytics', href: 'analytics', icon: BarChart3 },
  { name: 'Settings', href: 'settings', icon: Settings },
];

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = use(params);
  const pathname = usePathname();

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Fetch active sprint
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

  return (
    <div className="flex h-full flex-col">
      {/* Project Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/projects" className="hover:text-foreground transition-colors">
              Projects
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">
              {project?.name || projectId}
            </span>
            {project?.key && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {project.key}
              </span>
            )}
          </div>

          {/* Active Sprint Banner */}
          {activeSprint && (
            <Link
              href={`/projects/${projectId}/sprints/${activeSprint.id}`}
              className="mb-3 flex items-center gap-2 text-sm group"
            >
              <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-full group-hover:bg-green-500/20 transition-colors">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium">{activeSprint.name}</span>
                <span className="text-green-600/70 dark:text-green-400/70">
                  • {activeSprint.issueCount || 0} issues
                </span>
                <span className="text-green-600/50 dark:text-green-400/50 text-xs">
                  • ends {new Date(activeSprint.endDate).toLocaleDateString()}
                </span>
              </div>
            </Link>
          )}

          {/* Tab Navigation */}
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.href || 
                (tab.href === 'board' && currentTab === projectId);
              const Icon = tab.icon;
              
              return (
                <Link
                  key={tab.href}
                  href={`/projects/${projectId}/${tab.href}`}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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

