'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProjectSettingsDialog } from '@/components/projects/project-settings-dialog';
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
  Layers,
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
  { name: 'Modules', href: 'modules', icon: Layers },
  { name: 'Docs', href: 'docs', icon: BookOpenText },
  { name: 'Chat', href: 'chat', icon: MessagesSquare },
  { name: 'Analytics', href: 'analytics', icon: BarChart3 },
];

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const { permissions } = useProjectPermissions(projectId);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const activeSprint = sprints?.find((s: { status: string }) => s.status === 'active');
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
  const canOpenSettings = permissions.canBrowseProject || permissions.isSuperAdmin || permissions.isOrgOwner;

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-full flex-col">
        {/* Compact top bar — breadcrumb on the left, icon tabs in the center, actions on the right */}
        <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3 px-4 py-1.5">
            {/* Breadcrumb: Projects › name */}
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs">
              <Link
                href="/projects"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Projects
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className="truncate font-medium text-foreground">{projectName}</span>
              {project?.key && (
                <span className="ml-1 hidden font-mono text-[10px] text-muted-foreground sm:inline">
                  {project.key}
                </span>
              )}
            </nav>

            <div className="h-4 w-px bg-border/70" aria-hidden="true" />

            {/* Icon tabs */}
            <Tabs
              value={activeTabValue}
              onValueChange={(value) => router.push(`/projects/${projectId}/${value}`)}
              className="min-w-0"
            >
              <TabsList className="h-auto gap-0.5 bg-transparent p-0" aria-label="Project sections">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Tooltip key={tab.href}>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={tab.href}
                          aria-label={tab.name}
                          className="h-7 w-7 rounded-md px-0 data-[state=active]:bg-accent/60"
                        >
                          <Icon className="h-4 w-4" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {tab.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="ml-auto flex items-center gap-1.5">
              {activeSprint ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/projects/${projectId}/sprints/${activeSprint.id}`}
                      className="live-pill inline-flex items-center gap-1 text-[10px]"
                    >
                      <span className="font-medium">{activeSprint.name}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Active sprint · {activeSprint.issueCount ?? 0} issues
                  </TooltipContent>
                </Tooltip>
              ) : null}

              {canOpenSettings && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Project settings"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-7 w-7"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Settings
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {canOpenSettings && (
          <ProjectSettingsDialog
            projectId={projectId}
            open={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
