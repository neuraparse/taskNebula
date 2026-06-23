'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Tiny clipboard button for terminal snippets on the landing page.
 *
 * The only client island outside the interactive board demo — everything else
 * on the page renders as server components. Degrades gracefully: without JS
 * the snippet text is still visible and selectable.
 */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations('publicPages.landing.copy');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — leave the
      // snippet selectable and do nothing.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? t('copied') : (label ?? t('copyCommand'))}
      className="ease-snap inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-[var(--landing-border)] text-[var(--landing-text-muted)] transition-all duration-150 hover:bg-[var(--landing-bg-elevated)] hover:text-[var(--landing-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[var(--landing-accent-emerald)]" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? t('copiedToClipboard') : ''}
      </span>
    </button>
  );
}
