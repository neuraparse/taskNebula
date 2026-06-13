'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  { labelKey: 'tabViews', href: 'views', icon: PanelsTopLeft },
  { labelKey: 'tabBoard', href: 'board', icon: LayoutGrid },
  { labelKey: 'tabBacklog', href: 'backlog', icon: List },
  { labelKey: 'tabSprints', href: 'sprints', icon: Timer },
  { labelKey: 'tabModules', href: 'modules', icon: Layers },
  { labelKey: 'tabDocs', href: 'docs', icon: BookOpenText },
  { labelKey: 'tabChat', href: 'chat', icon: MessagesSquare },
  { labelKey: 'tabAnalytics', href: 'analytics', icon: BarChart3 },
] as const;

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = use(params);
  const t = useTranslations('pagesProjects');
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

  const activeTabValue = visibleTabs.some((t) => t.href === currentTab) ? currentTab : 'views';

  const projectName = project?.name || projectId;
  const canOpenSettings =
    permissions.canBrowseProject || permissions.isSuperAdmin || permissions.isOrgOwner;

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-full flex-col">
        {/* Compact top bar — breadcrumb on the left, icon tabs in the center, actions on the right */}
        <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 shrink-0 border-b backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-1.5">
            {/* Breadcrumb: Projects › name */}
            <nav aria-label={t('breadcrumb')} className="flex min-w-0 items-center gap-1 text-xs">
              <Link
                href="/projects"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('title')}
              </Link>
              <ChevronRight className="text-muted-foreground/50 h-3 w-3 shrink-0" />
              <span className="text-foreground truncate font-medium">{projectName}</span>
              {project?.key && (
                <span className="text-muted-foreground ml-1 hidden font-mono text-[10px] sm:inline">
                  {project.key}
                </span>
              )}
            </nav>

            <div className="bg-border/70 h-4 w-px" aria-hidden="true" />

            {/* Icon tabs — horizontally scrollable on narrow screens so the strip never overflows */}
            <Tabs
              value={activeTabValue}
              onValueChange={(value) => router.push(`/projects/${projectId}/${value}`)}
              className="min-w-0 flex-1"
            >
              <TabsList
                className="h-auto max-w-full justify-start gap-0.5 overflow-x-auto bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={t('sections')}
              >
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const tabLabel = t(tab.labelKey);
                  return (
                    <Tooltip key={tab.href}>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={tab.href}
                          aria-label={tabLabel}
                          className="data-[state=active]:bg-accent/60 h-7 w-7 shrink-0 rounded-md px-0"
                        >
                          <Icon className="h-4 w-4" />
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {tabLabel}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
                    {t('activeSprintTooltip', { count: activeSprint.issueCount ?? 0 })}
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
                      aria-label={t('projectSettings')}
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-7 w-7"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {t('settings')}
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
