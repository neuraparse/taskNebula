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
import { getTranslations } from 'next-intl/server';
import { AI_FEATURE_MODEL_CARDS, DISCLOSURE_VERSION } from '@/config/ai-model-cards';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aiModelCards.meta');

  return {
    title: t('title'),
    description: t('description'),
  };
}

/** Minimal markdown renderer — supports paragraphs, headings, lists, and bold. */
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList(key: string) {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
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
        <h3 key={`h-${idx}`} className="mb-2 mt-4 text-base font-semibold">
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
        className="text-muted-foreground text-sm"
        dangerouslySetInnerHTML={{ __html: inline(line) }}
      />
    );
  });
  flushList('tail');
  return out;
}

export default async function AiModelCardsPage() {
  const t = await getTranslations('aiModelCards');
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('back')}
      </Link>

      <header className="mb-8 space-y-2">
        <div className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <Sparkles className="text-primary h-3 w-3" />
          {t('disclosureBadge')}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t.rich('intro', {
            version: () => <code className="font-mono">{DISCLOSURE_VERSION}</code>,
          })}
        </p>
        <p className="text-muted-foreground text-xs">{t('lastReviewed')}</p>
      </header>

      <nav className="border-border bg-muted/30 mb-10 rounded-md border p-4">
        <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
          {t('onThisPage')}
        </p>
        <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
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
            <div className="border-primary mb-3 border-l-2 pl-4">
              <h2 className="text-xl font-semibold">{card.name}</h2>
              <p className="text-muted-foreground mt-1 text-xs">{card.purpose}</p>
            </div>

            <dl className="mb-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground mb-0.5 uppercase tracking-wider">
                  {t('model')}
                </dt>
                <dd className="font-mono">{card.defaultModel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5 uppercase tracking-wider">
                  {t('provider')}
                </dt>
                <dd className="font-mono">{card.defaultProvider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5 uppercase tracking-wider">
                  {t('oversightDefault')}
                </dt>
                <dd>
                  {card.defaultOversight === 'review_required'
                    ? t('reviewRequired')
                    : t('autoApplyAllowed')}
                </dd>
              </div>
            </dl>

            <div className="prose-sm space-y-2">{renderMarkdown(card.markdown)}</div>
          </section>
        ))}
      </div>

      <footer className="border-border text-muted-foreground mt-16 border-t pt-6 text-xs">
        <p>
          {t.rich('footerContact', {
            link: () => (
              <a href="mailto:privacy@tasknebula.com" className="underline">
                {'privacy@tasknebula.com'}
              </a>
            ),
          })}
        </p>
      </footer>
    </main>
  );
}
