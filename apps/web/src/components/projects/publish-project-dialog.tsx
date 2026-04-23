'use client';

import * as React from 'react';
import { Copy, ExternalLink, Globe, Layers, List, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useProjectPublish,
  type PublishConfig,
} from '@/lib/projects/use-project-publish';

export interface PublishProjectDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  projectId: string;
  projectName: string;
}

type PermissionKey =
  | 'allowComments'
  | 'allowReactions'
  | 'allowVoting'
  | 'showAttachments'
  | 'showCycles'
  | 'showModules';

interface PermissionRow {
  key: PermissionKey;
  label: string;
  helper: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: 'allowComments',
    label: 'Allow comments',
    helper: 'Visitors can leave comments on issues.',
  },
  {
    key: 'allowReactions',
    label: 'Allow reactions',
    helper: 'Visitors can react with emojis to issues and comments.',
  },
  {
    key: 'allowVoting',
    label: 'Allow voting',
    helper: 'Visitors can upvote or downvote issues.',
  },
  {
    key: 'showAttachments',
    label: 'Show attachments',
    helper: 'Display files and images attached to issues.',
  },
  {
    key: 'showCycles',
    label: 'Show cycles',
    helper: 'Expose cycle information to visitors.',
  },
  {
    key: 'showModules',
    label: 'Show modules',
    helper: 'Expose module groupings to visitors.',
  },
];

interface RadioCardProps {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function RadioCard({ active, onSelect, icon, title, description }: RadioCardProps): React.ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex flex-1 flex-col items-start gap-2 rounded-md border p-3 text-left transition-all duration-150 ease-snap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-accent/40',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md',
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

interface PermissionSwitchRowProps {
  label: string;
  helper: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}

function PermissionSwitchRow({
  label,
  helper,
  checked,
  onCheckedChange,
  disabled,
}: PermissionSwitchRowProps): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-card/40 p-3">
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{helper}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

export function PublishProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: PublishProjectDialogProps): React.ReactElement {
  const { config, publicUrl, updateConfig, publish, unpublish, copyLink } =
    useProjectPublish(projectId);

  const [isBusy, setIsBusy] = React.useState<boolean>(false);
  const [passwordProtected, setPasswordProtected] = React.useState<boolean>(
    Boolean(config.password),
  );

  React.useEffect(() => {
    setPasswordProtected(Boolean(config.password));
  }, [config.password]);

  const handleTogglePublish = React.useCallback(async () => {
    setIsBusy(true);
    try {
      if (config.enabled) {
        await unpublish();
      } else {
        await publish();
      }
    } finally {
      setIsBusy(false);
    }
  }, [config.enabled, publish, unpublish]);

  const setLayout = React.useCallback(
    (layout: PublishConfig['layout']) => updateConfig({ layout }),
    [updateConfig],
  );

  const setVisibility = React.useCallback(
    (visibility: PublishConfig['visibility']) => updateConfig({ visibility }),
    [updateConfig],
  );

  const setPermission = React.useCallback(
    (key: PermissionKey, value: boolean) => updateConfig({ [key]: value } as Partial<PublishConfig>),
    [updateConfig],
  );

  const handlePasswordToggle = React.useCallback(
    (next: boolean) => {
      setPasswordProtected(next);
      if (!next) {
        updateConfig({ password: null });
      }
    },
    [updateConfig],
  );

  const handlePasswordChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      updateConfig({ password: event.target.value });
    },
    [updateConfig],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Publish project</DialogTitle>
            {config.enabled ? (
              <Badge variant="success" className="ml-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald" />
                Live
              </Badge>
            ) : null}
          </div>
          <DialogDescription>
            Make <span className="font-medium text-foreground">{projectName}</span> accessible to
            anyone with the link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Layout */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Layout</h4>
              <span className="text-xs text-muted-foreground">Default view for visitors</span>
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Layout">
              <RadioCard
                active={config.layout === 'list'}
                onSelect={() => setLayout('list')}
                icon={<List className="h-4 w-4" />}
                title="List"
                description="Compact vertical list of issues."
              />
              <RadioCard
                active={config.layout === 'board'}
                onSelect={() => setLayout('board')}
                icon={<Layers className="h-4 w-4" />}
                title="Board"
                description="Kanban columns by status."
              />
            </div>
          </section>

          {/* Visibility */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Visibility</h4>
            <div className="flex gap-2" role="radiogroup" aria-label="Visibility">
              <RadioCard
                active={config.visibility === 'public'}
                onSelect={() => setVisibility('public')}
                icon={<Globe className="h-4 w-4" />}
                title="Public to internet"
                description="Anyone with the link can view."
              />
              <RadioCard
                active={config.visibility === 'team-only'}
                onSelect={() => setVisibility('team-only')}
                icon={<Lock className="h-4 w-4" />}
                title="Team only"
                description="Requires sign-in to view."
              />
            </div>
          </section>

          {/* Permissions */}
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Permissions</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PERMISSION_ROWS.map((row) => (
                <PermissionSwitchRow
                  key={row.key}
                  label={row.label}
                  helper={row.helper}
                  checked={Boolean(config[row.key])}
                  onCheckedChange={(next) => setPermission(row.key, next)}
                />
              ))}
            </div>
          </section>

          {/* Password protection */}
          <section className="space-y-2">
            <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-card/40 p-3">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Password protection
                </div>
                <div className="text-xs text-muted-foreground">
                  Require a password to access the published page.
                </div>
              </div>
              <Switch
                checked={passwordProtected}
                onCheckedChange={handlePasswordToggle}
                aria-label="Password protection"
              />
            </div>
            {passwordProtected ? (
              <Input
                type="text"
                placeholder="Set a password"
                value={config.password ?? ''}
                onChange={handlePasswordChange}
              />
            ) : null}
          </section>

          {/* Public URL */}
          {config.enabled ? (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Public URL</h4>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  aria-label="Copy public URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  asChild
                  aria-label="Open public URL"
                >
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={config.enabled ? 'destructive' : 'default'}
            onClick={handleTogglePublish}
            disabled={isBusy}
          >
            {config.enabled ? 'Unpublish' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PublishProjectDialog;
