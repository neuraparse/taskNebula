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
    <Dialog open={open} onOpenChange={() => { /* modal is non-dismissable */ }}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="ai-disclosure-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            You are about to interact with AI
          </DialogTitle>
          <DialogDescription>
            Some TaskNebula features use third-party AI models to generate text,
            suggestions, and summaries. Before you continue, please read what
            that means for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <p className="font-medium text-foreground">What runs in your workspace</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {USER_FACING_AI_FEATURES.map((f) => (
                <li key={f.id}>
                  <span className="text-foreground">{f.name}</span> — {f.summary}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Your rights
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Every AI output is labelled <em>Generated with AI</em>.</li>
              <li>You can review and reject any AI suggestion before it is applied.</li>
              <li>Workspace admins can disable any AI feature in Settings → AI Transparency.</li>
              <li>Inputs/outputs are retained per the model card retention policy and never sold.</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Read the{' '}
            <Link
              href="/ai-model-cards"
              target="_blank"
              className="underline inline-flex items-center gap-0.5 hover:text-foreground"
            >
              full model cards
              <ExternalLink className="h-3 w-3" />
            </Link>{' '}
            for each feature, including model identity, data sent, and retention.
          </p>

          <p className="text-[10px] text-muted-foreground/80">
            Disclosure version {version}. Required by EU AI Act Article 50.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            onClick={handleAck}
            disabled={busy}
            data-testid="ai-disclosure-ack"
          >
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            I understand, continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
