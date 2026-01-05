'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Inbox,
  FolderKanban,
  Users,
  Settings,
  Sparkles,
  ChevronDown,
  Plus,
  Circle,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useProjects } from '@/lib/hooks/use-projects';

const navigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'My Issues', href: '/my-issues', icon: Inbox },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Team', href: '/team', icon: Users },
];

const aiFeatures = [
  { name: 'AI Assistant', href: '/ai', icon: Sparkles },
];

const projectColors = [
  'fill-blue-500 text-blue-500',
  'fill-green-500 text-green-500',
  'fill-purple-500 text-purple-500',
  'fill-orange-500 text-orange-500',
  'fill-pink-500 text-pink-500',
  'fill-cyan-500 text-cyan-500',
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Check if user is super admin
  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await fetch('/api/user/me');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useProjects();

  const isSuperAdmin = userData?.isSuperAdmin || false;

  return (
    <aside className="flex w-64 flex-col border-r border-muted-foreground/10 bg-gradient-to-b from-background via-background to-muted/10 shadow-sm">
      {/* Organization Selector */}
      <div className="border-b border-muted-foreground/10 p-4 bg-background/80 backdrop-blur-xl">
        <button className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-accent/50 transition-all duration-300 group border border-transparent hover:border-primary/20 hover:shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center border border-primary/20 shadow-sm">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">TN</AvatarFallback>
              </Avatar>
            </div>
            <span className="tracking-tight font-semibold">TaskNebula</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:translate-y-0.5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm border border-primary/20 hover:shadow-md'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground border border-transparent hover:border-border/50'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-primary/50 via-primary to-primary/50 rounded-r-full shadow-sm" />
              )}
              <item.icon className={cn(
                "h-4 w-4 transition-all duration-200 group-hover:scale-110",
                isActive && "text-primary"
              )} />
              <span className="tracking-tight font-medium">{item.name}</span>
            </Link>
          );
        })}

        <div className="pt-4">
          <div className="mb-2 px-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 tracking-wider">AI</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          </div>
          {aiFeatures.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative',
                  isActive
                    ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 shadow-sm border border-purple-500/20 hover:shadow-md'
                    : 'text-muted-foreground hover:bg-gradient-to-r hover:from-purple-500/5 hover:to-pink-500/5 hover:text-purple-600 dark:hover:text-purple-400 border border-transparent hover:border-purple-500/20'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full shadow-sm shadow-purple-500/50" />
                )}
                <item.icon className={cn(
                  "h-4 w-4 transition-all duration-200 group-hover:scale-110",
                  isActive && "text-purple-600 dark:text-purple-400"
                )} />
                <span className="tracking-tight font-medium">{item.name}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">Beta</Badge>
              </Link>
            );
          })}
        </div>

        <div className="pt-4">
          <div className="mb-2 flex items-center justify-between px-3">
            <span className="text-xs font-bold text-muted-foreground tracking-wider">PROJECTS</span>
            <Link href="/projects">
              <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-110">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {/* Dynamic Project List */}
          <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : projects && projects.length > 0 ? (
              projects.slice(0, 5).map((project, index) => {
                const colorClass = projectColors[index % projectColors.length];
                const projectPath = project.key?.toLowerCase() || project.id;
                const isActive = pathname?.includes(`/projects/${projectPath}`);
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${projectPath}/board`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 group border border-transparent",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground hover:border-border/50"
                    )}
                  >
                    <Circle className={cn("h-2 w-2 transition-transform duration-200 group-hover:scale-125", colorClass)} />
                    <span className="tracking-tight truncate font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground/70 ml-auto font-mono">{project.key}</span>
                  </Link>
                );
              })
            ) : (
              <div className="px-3 py-6 text-xs text-center text-muted-foreground">
                No projects yet
              </div>
            )}
            {projects && projects.length > 5 && (
              <Link
                href="/projects"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all duration-200"
              >
                View all {projects.length} projects...
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* User Profile & Settings */}
      <div className="border-t border-muted-foreground/10 p-3 bg-gradient-to-t from-muted/20 to-background/50 backdrop-blur-xl">
        {/* Super Admin Link */}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group border border-transparent mb-2",
              pathname === '/admin'
                ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 shadow-sm border-purple-500/20'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground hover:border-border/50'
            )}
          >
            <Shield className={cn(
              "h-4 w-4 transition-all duration-200 group-hover:scale-110",
              pathname === '/admin' && "text-purple-600 dark:text-purple-400"
            )} />
            <span className="tracking-tight font-medium">Super Admin</span>
            <Badge variant="secondary" className="ml-auto text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-semibold">Admin</Badge>
          </Link>
        )}

        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group border border-transparent",
            pathname === '/settings'
              ? 'bg-primary/10 text-primary shadow-sm border-primary/20'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground hover:border-border/50'
          )}
        >
          <Settings className={cn(
            "h-4 w-4 transition-all duration-300 group-hover:rotate-90",
            pathname === '/settings' && "text-primary"
          )} />
          <span className="tracking-tight font-medium">Settings</span>
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/50 transition-all duration-200 cursor-pointer group border border-transparent hover:border-border/50 hover:shadow-sm">
          <Avatar className="h-8 w-8 ring-2 ring-background shadow-md group-hover:ring-primary/20 transition-all duration-200">
            {session?.user?.image && <AvatarImage src={session.user.image} />}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 font-semibold text-primary">
              {session?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">
              {session?.user?.name || 'User'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{session?.user?.email || ''}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

