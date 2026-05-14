/**
 * /ai-model-cards — public, unauthenticated AI Model Cards page.
 *
 * Required by EU AI Act Article 50 (in force 2026-08-02). Each card describes
 * an AI feature TaskNebula deploys to end-users: purpose, model identity,
 * data sent, retention, and human-oversight default.
 *
 * Sourced from apps/web/src/config/ai-model-cards.ts so the same content
 * powers the in-app Transparency settings page and the first-time
 * disclosure modal.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { AI_FEATURE_MODEL_CARDS, DISCLOSURE_VERSION } from '@/config/ai-model-cards';

export const metadata: Metadata = {
  title: 'AI Model Cards — TaskNebula',
  description:
    'Public AI transparency disclosures for every AI feature TaskNebula deploys, as required by EU AI Act Article 50.',
};

/** Minimal markdown renderer — supports paragraphs, headings, lists, and bold. */
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList(key: string) {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
        {listBuffer.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
        ))}
      </ul>
    );
    listBuffer = [];
  }

  function inline(s: string): string {
    return s
      .replace(/`([^`]+)`/g, '<code class="font-mono text-foreground/90">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList(`b-${idx}`);
      return;
    }
    if (line.startsWith('## ')) {
      flushList(`h-${idx}`);
      out.push(
        <h3 key={`h-${idx}`} className="text-base font-semibold mt-4 mb-2">
          {line.slice(3)}
        </h3>
      );
      return;
    }
    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
      return;
    }
    flushList(`p-${idx}`);
    out.push(
      <p
        key={`p-${idx}`}
        className="text-sm text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: inline(line) }}
      />
    );
  });
  flushList('tail');
  return out;
}

export default function AiModelCardsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to TaskNebula
      </Link>

      <header className="mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          EU AI Act Article 50 disclosure
        </div>
        <h1 className="text-3xl font-bold tracking-tight">AI Model Cards</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          TaskNebula deploys the following AI features to end users. For each, we
          publish the intended purpose, model identity, data sent on every call,
          retention policy, and our default human-oversight posture. This page is
          a public transparency record and applies to all TaskNebula
          deployments. Disclosure version <code className="font-mono">{DISCLOSURE_VERSION}</code>.
        </p>
        <p className="text-xs text-muted-foreground">
          Last reviewed 2026-05-14. Regulation enforcement begins 2026-08-02.
        </p>
      </header>

      <nav className="mb-10 rounded-md border border-border bg-muted/30 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          On this page
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
          {AI_FEATURE_MODEL_CARDS.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} className="text-foreground hover:underline">
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-10">
        {AI_FEATURE_MODEL_CARDS.map((card) => (
          <section
            key={card.id}
            id={card.id}
            className="scroll-mt-20"
            data-testid={`model-card-${card.id}`}
          >
            <div className="border-l-2 border-primary pl-4 mb-3">
              <h2 className="text-xl font-semibold">{card.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{card.purpose}</p>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-4">
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider mb-0.5">
                  Model
                </dt>
                <dd className="font-mono">{card.defaultModel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider mb-0.5">
                  Provider
                </dt>
                <dd className="font-mono">{card.defaultProvider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider mb-0.5">
                  Oversight default
                </dt>
                <dd>
                  {card.defaultOversight === 'review_required'
                    ? 'Review required'
                    : 'Auto-apply allowed'}
                </dd>
              </div>
            </dl>

            <div className="prose-sm space-y-2">{renderMarkdown(card.markdown)}</div>
          </section>
        ))}
      </div>

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          Questions about AI transparency, data subject rights, or these model
          cards? Email{' '}
          <a href="mailto:privacy@tasknebula.com" className="underline">
            privacy@tasknebula.com
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
