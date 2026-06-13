'use client';

/**
 * AiDisclosureModal — first-time AI involvement notice (EU AI Act Article 50).
 *
 * Rendered once per (user, workspace, disclosure-version). When the user
 * acknowledges, the version is POST'd to /api/ai/disclosures and persisted
 * in ai_disclosures_acknowledged.
 *
 * Mount this near the root of the (app) layout so it surfaces the first time
 * an AI surface loads — see app/(app)/layout.tsx integration.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Sparkles, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAiDisclosure } from '@/lib/hooks/use-ai-disclosure';
import { USER_FACING_AI_FEATURES } from '@/config/ai-model-cards';

export function AiDisclosureModal() {
  const t = useTranslations('aiFeatures');
  const { needsAcknowledgement, version, acknowledge } = useAiDisclosure();
  const [busy, setBusy] = useState(false);
  // Local open state so the dialog can close immediately after click while
  // the POST is still in flight.
  const [forceClosed, setForceClosed] = useState(false);

  const open = needsAcknowledgement && !forceClosed;

  async function handleAck() {
    setBusy(true);
    try {
      await acknowledge();
      setForceClosed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* modal is non-dismissable */
      }}
    >
      <DialogContent
        className="!flex max-h-[calc(100vh-2rem)] max-w-lg !grid-cols-none flex-col gap-0 overflow-hidden p-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="ai-disclosure-modal"
      >
        <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
          <DialogTitle className="flex items-center gap-2 tracking-normal">
            <Sparkles className="text-primary h-4 w-4" />
            {t('disclosure.title')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t('disclosure.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-2 text-sm">
          <div className="border-border bg-muted space-y-2 rounded-md border p-3">
            <p className="text-foreground font-medium">{t('disclosure.whatRunsTitle')}</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              {USER_FACING_AI_FEATURES.map((f) => (
                <li key={f.id}>
                  <span className="text-foreground">{f.name}</span> — {f.summary}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border bg-muted space-y-1 rounded-md border p-3">
            <p className="text-foreground flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('disclosure.rightsTitle')}
            </p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>
                {t.rich('disclosure.rightLabelled', {
                  label: (chunks) => <em>{chunks}</em>,
                })}
              </li>
              <li>{t('disclosure.rightReview')}</li>
              <li>{t('disclosure.rightDisable')}</li>
              <li>{t('disclosure.rightRetention')}</li>
            </ul>
          </div>

          <p className="text-muted-foreground text-xs">
            {t.rich('disclosure.modelCardsLine', {
              link: (chunks) => (
                <Link
                  href="/ai-model-cards"
                  target="_blank"
                  className="hover:text-foreground inline-flex items-center gap-0.5 underline"
                >
                  {chunks}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ),
            })}
          </p>

          <p className="text-muted-foreground text-[10px]">
            {t('disclosure.versionLine', { version })}
          </p>
        </div>

        <div className="border-border bg-muted/40 flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          <Button onClick={handleAck} disabled={busy} data-testid="ai-disclosure-ack">
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t('disclosure.acknowledge')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
