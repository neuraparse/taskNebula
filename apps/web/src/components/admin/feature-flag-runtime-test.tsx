'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Zap } from 'lucide-react';
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

type TestResult = {
  enabled: boolean;
  source: 'db' | 'cache' | 'default';
  organizationId?: string;
  reason?: string;
  flag?: {
    key: string;
    isEnabled: boolean;
    rolloutPercentage: number;
    enabledForPlans: string[];
    enabledForOrganizations: string[];
  };
};

interface FeatureFlagRuntimeTestProps {
  defaultKey?: string;
}

export function FeatureFlagRuntimeTest({ defaultKey = '' }: FeatureFlagRuntimeTestProps) {
  const t = useTranslations('adminPanels');
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(defaultKey);
  const [organizationId, setOrganizationId] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ key: key.trim() });
      if (organizationId.trim()) params.set('organizationId', organizationId.trim());
      const response = await fetch(`/api/admin/feature-flags/test?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t('flagTest.evaluateFailed'));
      }
      setResult(payload as TestResult);
    } catch {
      setError(t('flagTest.evaluateFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResult(null);
          setError(null);
        } else {
          setKey(defaultKey);
        }
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Zap className="mr-1.5 h-4 w-4" />
        {t('flagTest.runtimeTest')}
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('flagTest.title')}</DialogTitle>
          <DialogDescription>{t('flagTest.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-key">{t('flagTest.flagKey')}</Label>
            <Input
              id="test-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('flagTest.keyPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="test-org">{t('flagTest.organizationIdOptional')}</Label>
            <Input
              id="test-org"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder={t('flagTest.organizationIdPlaceholder')}
            />
          </div>

          {error ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="border-border bg-muted/30 space-y-2 rounded-md border px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('flagTest.enabled')}</span>
                <span className={result.enabled ? 'chip-emerald' : 'chip-rose'}>
                  {result.enabled ? 'true' : 'false'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('flagTest.source')}</span>
                <span className="chip font-mono">{result.source}</span>
              </div>
              {result.organizationId ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t('flagTest.org')}</span>
                  <span className="truncate font-mono">{result.organizationId}</span>
                </div>
              ) : null}
              {result.flag ? (
                <div className="border-border mt-2 space-y-1 border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('flagTest.isEnabled')}</span>
                    <span className="font-mono">{String(result.flag.isEnabled)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('flagTest.rolloutPercent')}</span>
                    <span className="font-mono">{result.flag.rolloutPercentage}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t('flagTest.plans')}</span>
                    <span className="truncate font-mono">
                      {result.flag.enabledForPlans.length === 0
                        ? '—'
                        : result.flag.enabledForPlans.join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t('flagTest.targetedOrgs')}</span>
                    <span className="font-mono">{result.flag.enabledForOrganizations.length}</span>
                  </div>
                </div>
              ) : null}
              {result.reason ? <p className="text-muted-foreground mt-2">{result.reason}</p> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t('flagTest.close')}
          </Button>
          <Button type="button" onClick={run} disabled={loading || !key.trim()}>
            {loading ? t('flagTest.evaluating') : t('flagTest.evaluate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
