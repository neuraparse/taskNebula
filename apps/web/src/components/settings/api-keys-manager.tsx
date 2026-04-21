'use client';

import { useState } from 'react';
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
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch API keys' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch API keys');
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
      const payload = await response.json().catch(() => ({ error: 'Failed to create API key' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create API key');
      }
      return payload as { apiKey: { key: string } };
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', organizationId] });
      setCreatedKey(payload.apiKey.key);
      setNewKeyName('');
      setExpiryPreset('never');
      toast({
        title: 'API key created',
        description: 'Copy the key now. It will not be shown again.',
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Failed to create API key',
        description: mutationError.message,
        variant: 'destructive',
      });
    },
  });

  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({ error: 'Failed to revoke API key' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to revoke API key');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', organizationId] });
      toast({
        title: 'API key revoked',
        description: 'The key can no longer be used.',
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: 'Failed to revoke API key',
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
            <span className="kicker">Integrations</span>
            <h2 className="text-lg font-semibold tracking-tight">API keys</h2>
            <p className="text-sm text-muted-foreground max-w-prose">
              Create and revoke keys for service integrations and automation.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Create key
          </Button>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading API keys...</p>
        ) : error ? (
          <div className="panel-warn text-sm">
            {error instanceof Error ? error.message : 'API keys could not be loaded.'}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Key className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              Create your first key
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
                      <span className="chip-emerald">Active</span>
                    ) : (
                      <span className="chip">Revoked</span>
                    )}
                    {key.expiresAt ? (
                      <span className="chip">
                        Expires {new Date(key.expiresAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">{key.keyPrefix}...</code>
                    <span>
                      Created {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                    </span>
                    {key.lastUsedAt ? (
                      <span>
                        Last used{' '}
                        {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                      </span>
                    ) : null}
                  </div>
                </div>
                {key.isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Revoke "${key.name}"?`)) {
                        revokeKey.mutate(key.id);
                      }
                    }}
                    disabled={revokeKey.isPending}
                    aria-label="Revoke key"
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
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? 'Copy this key now. It will only be shown once.'
                : 'Choose a name and optional expiration for the new key.'}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="rounded-md bg-surface p-4">
                <code className="break-all text-sm">{createdKey}</code>
              </div>
              <Button onClick={handleCopyKey} className="w-full">
                {copiedKey ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copiedKey ? 'Copied' : 'Copy to clipboard'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key name</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(event) => setNewKeyName(event.target.value)}
                  placeholder="Production automation"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration</Label>
                <Select value={expiryPreset} onValueChange={setExpiryPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                    <SelectItem value="365d">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={handleCloseDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyName.trim() || createKey.isPending}
                >
                  {createKey.isPending ? 'Creating...' : 'Create key'}
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
