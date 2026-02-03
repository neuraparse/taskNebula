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
  Shield,
  Loader2,
  Lock,
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

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await fetch('/api/user/me');
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const { data: projects, isLoading: projectsLoading } = useProjects();

  const isSuperAdmin = userData?.isSuperAdmin || false;

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      {/* Organization Selector */}
      <div className="border-b border-border p-3">
        <button className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-medium hover:bg-accent transition-colors">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">T</span>
            </div>
            <span className="font-semibold text-foreground">TaskNebula</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* AI Section */}
        <div className="pt-4">
          <div className="mb-1 px-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              AI Features
            </span>
          </div>
          {aiFeatures.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground/60 cursor-not-allowed"
            >
              <Lock className="h-4 w-4" />
              <span>{item.name}</span>
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 h-4 font-semibold border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                Enterprise
              </Badge>
            </div>
          ))}
        </div>

        {/* Projects Section */}
        <div className="pt-4">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
            <Link href="/projects">
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : projects && projects.length > 0 ? (
              projects.slice(0, 5).map((project) => {
                const projectPath = project.key?.toLowerCase() || project.id;
                const isActive = pathname?.includes(`/projects/${projectPath}`);
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${projectPath}/board`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors group',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {project.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate flex-1">{project.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {project.key}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="px-2 py-4 text-center">
                <p className="text-xs text-muted-foreground">No projects yet</p>
              </div>
            )}
            {projects && projects.length > 5 && (
              <Link
                href="/projects"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                View all {projects.length} projects
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* User Profile & Settings */}
      <div className="border-t border-border p-2 space-y-0.5">
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              pathname === '/admin'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </Link>
        )}

        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>

        {/* User Profile */}
        <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent transition-colors cursor-pointer">
          <Avatar className="h-6 w-6">
            {session?.user?.image && <AvatarImage src={session.user.image} />}
            <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
              {session?.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">
              {session?.user?.name || 'User'}
            </p>
          </div>
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </div>
      </div>
    </aside>
  );
}
