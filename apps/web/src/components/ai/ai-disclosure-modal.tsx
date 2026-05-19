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
            You are about to interact with AI
          </DialogTitle>
          <DialogDescription className="text-zinc-300">
            Some TaskNebula features use third-party AI models to generate text, suggestions, and
            summaries. Before you continue, please read what that means for you.
          </DialogDescription>
        </DialogHeader>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-2 text-sm">
          <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
            <p className="font-medium text-zinc-100">What runs in your workspace</p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              {USER_FACING_AI_FEATURES.map((f) => (
                <li key={f.id}>
                  <span className="text-zinc-100">{f.name}</span> — {f.summary}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1 rounded-md border border-white/10 bg-white/5 p-3">
            <p className="flex items-center gap-1.5 font-medium text-zinc-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Your rights
            </p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              <li>
                Every AI output is labelled <em>Generated with AI</em>.
              </li>
              <li>You can review and reject any AI suggestion before it is applied.</li>
              <li>Workspace admins can disable any AI feature in Settings → AI Transparency.</li>
              <li>
                Inputs/outputs are retained per the model card retention policy and never sold.
              </li>
            </ul>
          </div>

          <p className="text-xs text-zinc-300">
            Read the{' '}
            <Link
              href="/ai-model-cards"
              target="_blank"
              className="inline-flex items-center gap-0.5 underline hover:text-zinc-100"
            >
              full model cards
              <ExternalLink className="h-3 w-3" />
            </Link>{' '}
            for each feature, including model identity, data sent, and retention.
          </p>

          <p className="text-[10px] text-zinc-400">
            Disclosure version {version}. Required by EU AI Act Article 50.
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-zinc-950/30 px-6 py-4">
          <Button onClick={handleAck} disabled={busy} data-testid="ai-disclosure-ack">
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}I understand, continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
