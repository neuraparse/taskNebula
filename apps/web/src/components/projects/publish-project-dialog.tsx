'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
import { useProjectPublish, type PublishConfig } from '@/lib/projects/use-project-publish';

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
  labelKey: string;
  helperKey: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: 'allowComments',
    labelKey: 'perm_allow_comments',
    helperKey: 'perm_allow_comments_helper',
  },
  {
    key: 'allowReactions',
    labelKey: 'perm_allow_reactions',
    helperKey: 'perm_allow_reactions_helper',
  },
  {
    key: 'allowVoting',
    labelKey: 'perm_allow_voting',
    helperKey: 'perm_allow_voting_helper',
  },
  {
    key: 'showAttachments',
    labelKey: 'perm_show_attachments',
    helperKey: 'perm_show_attachments_helper',
  },
  {
    key: 'showCycles',
    labelKey: 'perm_show_cycles',
    helperKey: 'perm_show_cycles_helper',
  },
  {
    key: 'showModules',
    labelKey: 'perm_show_modules',
    helperKey: 'perm_show_modules_helper',
  },
];

interface RadioCardProps {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function RadioCard({
  active,
  onSelect,
  icon,
  title,
  description,
}: RadioCardProps): React.ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'ease-snap focus-visible:ring-ring focus-visible:ring-offset-background flex flex-1 flex-col items-start gap-2 rounded-md border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-accent/40'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md',
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        {icon}
      </div>
      <div className="space-y-0.5">
        <div className="text-foreground text-sm font-medium">{title}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
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
    <div className="border-border/60 bg-card/40 flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="min-w-0 space-y-0.5">
        <div className="text-foreground text-sm font-medium">{label}</div>
        <div className="text-muted-foreground text-xs">{helper}</div>
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
  const t = useTranslations('projectsPages');
  const { config, publicUrl, updateConfig, publish, unpublish, copyLink } =
    useProjectPublish(projectId);

  const [isBusy, setIsBusy] = React.useState<boolean>(false);
  const [passwordProtected, setPasswordProtected] = React.useState<boolean>(
    Boolean(config.password)
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
    [updateConfig]
  );

  const setVisibility = React.useCallback(
    (visibility: PublishConfig['visibility']) => updateConfig({ visibility }),
    [updateConfig]
  );

  const setPermission = React.useCallback(
    (key: PermissionKey, value: boolean) =>
      updateConfig({ [key]: value } as Partial<PublishConfig>),
    [updateConfig]
  );

  const handlePasswordToggle = React.useCallback(
    (next: boolean) => {
      setPasswordProtected(next);
      if (!next) {
        updateConfig({ password: null });
      }
    },
    [updateConfig]
  );

  const handlePasswordChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      updateConfig({ password: event.target.value });
    },
    [updateConfig]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{t('publish_project')}</DialogTitle>
            {config.enabled ? (
              <Badge variant="success" className="ml-1">
                <span className="bg-accent-emerald h-1.5 w-1.5 rounded-full" />
                {t('live')}
              </Badge>
            ) : null}
          </div>
          <DialogDescription>
            {t.rich('publish_dialog_description', {
              name: projectName,
              strong: (chunks) => <span className="text-foreground font-medium">{chunks}</span>,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Layout */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-foreground text-sm font-semibold">{t('layout_heading')}</h4>
              <span className="text-muted-foreground text-xs">{t('layout_default_view')}</span>
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label={t('layout_heading')}>
              <RadioCard
                active={config.layout === 'list'}
                onSelect={() => setLayout('list')}
                icon={<List className="h-4 w-4" />}
                title={t('layout_list_title')}
                description={t('layout_list_description')}
              />
              <RadioCard
                active={config.layout === 'board'}
                onSelect={() => setLayout('board')}
                icon={<Layers className="h-4 w-4" />}
                title={t('layout_board_title')}
                description={t('layout_board_description')}
              />
            </div>
          </section>

          {/* Visibility */}
          <section className="space-y-2">
            <h4 className="text-foreground text-sm font-semibold">{t('visibility_heading')}</h4>
            <div className="flex gap-2" role="radiogroup" aria-label={t('visibility_heading')}>
              <RadioCard
                active={config.visibility === 'public'}
                onSelect={() => setVisibility('public')}
                icon={<Globe className="h-4 w-4" />}
                title={t('visibility_public_title')}
                description={t('visibility_public_description')}
              />
              <RadioCard
                active={config.visibility === 'team-only'}
                onSelect={() => setVisibility('team-only')}
                icon={<Lock className="h-4 w-4" />}
                title={t('visibility_team_title')}
                description={t('visibility_team_description')}
              />
            </div>
          </section>

          {/* Permissions */}
          <section className="space-y-2">
            <h4 className="text-foreground text-sm font-semibold">{t('permissions_heading')}</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PERMISSION_ROWS.map((row) => (
                <PermissionSwitchRow
                  key={row.key}
                  label={t(row.labelKey)}
                  helper={t(row.helperKey)}
                  checked={Boolean(config[row.key])}
                  onCheckedChange={(next) => setPermission(row.key, next)}
                />
              ))}
            </div>
          </section>

          {/* Password protection */}
          <section className="space-y-2">
            <div className="border-border/60 bg-card/40 flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0 space-y-0.5">
                <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Lock className="h-3.5 w-3.5" />
                  {t('password_protection')}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t('password_protection_helper')}
                </div>
              </div>
              <Switch
                checked={passwordProtected}
                onCheckedChange={handlePasswordToggle}
                aria-label={t('password_protection')}
              />
            </div>
            {passwordProtected ? (
              <Input
                type="text"
                placeholder={t('password_placeholder')}
                value={config.password ?? ''}
                onChange={handlePasswordChange}
              />
            ) : null}
          </section>

          {/* Public URL */}
          {config.enabled ? (
            <section className="space-y-2">
              <h4 className="text-foreground text-sm font-semibold">{t('public_url')}</h4>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  aria-label={t('copy_public_url')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  asChild
                  aria-label={t('open_public_url')}
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
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant={config.enabled ? 'destructive' : 'default'}
            onClick={handleTogglePublish}
            disabled={isBusy}
          >
            {config.enabled ? t('unpublish') : t('publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PublishProjectDialog;
