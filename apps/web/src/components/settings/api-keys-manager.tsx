'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, Key, Plus, Trash2 } from 'lucide-react';

interface ApiKeysManagerProps {
  organizationId: string;
}

type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export function ApiKeysManager({ organizationId }: ApiKeysManagerProps) {
  const t = useTranslations('settingsConfig');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [expiryPreset, setExpiryPreset] = useState('never');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['api-keys', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/api-keys?organizationId=${organizationId}`);
      const payload = await response.json().catch(() => ({ error: t('apiKeys.fetch_failed') }));
      if (!response.ok) {
        throw new Error(payload.error || t('apiKeys.fetch_failed'));
      }
      return payload as { apiKeys: ApiKeyItem[] };
    },
    enabled: !!organizationId,
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const expiresAt = getExpiryDate(expiryPreset);
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          organizationId,
          expiresAt: expiresAt?.toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({ error: t('apiKeys.create_failed') }));
      if (!response.ok) {
        throw new Error(payload.error || t('apiKeys.create_failed'));
      }
      return payload as { apiKey: { key: string } };
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', organizationId] });
      setCreatedKey(payload.apiKey.key);
      setNewKeyName('');
      setExpiryPreset('never');
      toast({
        title: t('apiKeys.created_toast_title'),
        description: t('apiKeys.created_toast_desc'),
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: t('apiKeys.create_failed'),
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({ error: t('apiKeys.revoke_failed') }));
      if (!response.ok) {
        throw new Error(payload.error || t('apiKeys.revoke_failed'));
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', organizationId] });
      toast({
        title: t('apiKeys.revoked_toast_title'),
        description: t('apiKeys.revoked_toast_desc'),
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: t('apiKeys.revoke_failed'),
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    await createKey.mutateAsync(newKeyName.trim());
  }

  function handleCopyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handleCloseDialog() {
    setIsCreateDialogOpen(false);
    setCreatedKey(null);
    setNewKeyName('');
    setCopiedKey(false);
    setExpiryPreset('never');
  }

  const apiKeys = data?.apiKeys || [];

  return (
    <>
      <section className="animate-fade-up space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="kicker">{t('apiKeys.kicker')}</span>
            <h2 className="text-lg font-semibold tracking-tight">{t('apiKeys.heading')}</h2>
            <p className="text-muted-foreground max-w-prose text-sm">{t('apiKeys.subtitle')}</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {t('apiKeys.create_key')}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t('apiKeys.loading')}</p>
        ) : error ? (
          <div className="panel-warn text-sm">
            {error instanceof Error ? error.message : t('apiKeys.load_error')}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Key className="text-muted-foreground/50 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('apiKeys.empty')}</p>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              {t('apiKeys.create_first')}
            </Button>
          </div>
        ) : (
          <div className="surface-card rounded-lg p-2">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="row-interactive flex min-h-[52px] items-center justify-between gap-4 rounded-md px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{key.name}</span>
                    {key.isActive ? (
                      <span className="chip-emerald">{t('apiKeys.status_active')}</span>
                    ) : (
                      <span className="chip">{t('apiKeys.status_revoked')}</span>
                    )}
                    {key.expiresAt ? (
                      <span className="chip">
                        {t('apiKeys.expires', {
                          date: new Date(key.expiresAt).toLocaleDateString(),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <code className="bg-muted rounded px-1.5 py-0.5">{key.keyPrefix}...</code>
                    <span>
                      {t('apiKeys.created', {
                        ago: formatDistanceToNow(new Date(key.createdAt), { addSuffix: true }),
                      })}
                    </span>
                    {key.lastUsedAt ? (
                      <span>
                        {t('apiKeys.last_used', {
                          ago: formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true }),
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
                {key.isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                    onClick={() => {
                      if (window.confirm(t('apiKeys.revoke_confirm', { name: key.name }))) {
                        revokeKey.mutate(key.id);
                      }
                    }}
                    disabled={revokeKey.isPending}
                    aria-label={t('apiKeys.revoke_aria')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={isCreateDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdKey ? t('apiKeys.dialog_created_title') : t('apiKeys.dialog_create_title')}
            </DialogTitle>
            <DialogDescription>
              {createdKey ? t('apiKeys.dialog_created_desc') : t('apiKeys.dialog_create_desc')}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="bg-surface rounded-md p-4">
                <code className="break-all text-sm">{createdKey}</code>
              </div>
              <Button onClick={handleCopyKey} className="w-full">
                {copiedKey ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiedKey ? t('apiKeys.copied') : t('apiKeys.copy_to_clipboard')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">{t('apiKeys.key_name_label')}</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(event) => setNewKeyName(event.target.value)}
                  placeholder={t('apiKeys.key_name_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('apiKeys.expiration_label')}</Label>
                <Select value={expiryPreset} onValueChange={setExpiryPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">{t('apiKeys.expiry_never')}</SelectItem>
                    <SelectItem value="30d">{t('apiKeys.expiry_30d')}</SelectItem>
                    <SelectItem value="90d">{t('apiKeys.expiry_90d')}</SelectItem>
                    <SelectItem value="365d">{t('apiKeys.expiry_365d')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={handleCloseDialog}>{t('apiKeys.done')}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseDialog}>
                  {t('apiKeys.cancel')}
                </Button>
                <Button onClick={handleCreate} disabled={!newKeyName.trim() || createKey.isPending}>
                  {createKey.isPending ? t('apiKeys.creating') : t('apiKeys.create_key')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getExpiryDate(preset: string) {
  if (preset === 'never') return null;
  const date = new Date();
  if (preset === '30d') date.setDate(date.getDate() + 30);
  else if (preset === '90d') date.setDate(date.getDate() + 90);
  else if (preset === '365d') date.setFullYear(date.getFullYear() + 1);
  return date;
}
