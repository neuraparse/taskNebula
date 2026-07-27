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
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="grid gap-6 border-b pb-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.14em]">
            {t('disclosureBadge')}
          </p>
          <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
            {t('title')}
          </h1>
        </div>
        <div className="self-end">
          <p className="text-muted-foreground max-w-2xl text-sm leading-7">
            {t.rich('intro', {
              version: () => (
                <code className="text-foreground font-mono">{DISCLOSURE_VERSION}</code>
              ),
            })}
          </p>
          <p className="text-muted-foreground mt-3 text-xs">{t('lastReviewed')}</p>
        </div>
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label={t('onThisPage')} className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-[0.14em]">
            {t('onThisPage')}
          </p>
          <ul className="border-border grid grid-cols-1 border-t text-sm sm:grid-cols-2 lg:grid-cols-1">
            {AI_FEATURE_MODEL_CARDS.map((card) => (
              <li key={card.id} className="border-border border-b">
                <a
                  href={`#${card.id}`}
                  className="hover:text-foreground focus-visible:ring-ring text-muted-foreground block rounded-sm py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                >
                  {card.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-border divide-border min-w-0 divide-y border-t">
          {AI_FEATURE_MODEL_CARDS.map((card, index) => (
            <section
              key={card.id}
              id={card.id}
              className="grid scroll-mt-20 gap-5 py-10 sm:grid-cols-[2rem_minmax(0,1fr)]"
              data-testid={`model-card-${card.id}`}
            >
              <span className="text-muted-foreground font-mono text-xs" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0">
                <header>
                  <h2 className="text-xl font-semibold tracking-tight">{card.name}</h2>
                  <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                    {card.purpose}
                  </p>
                </header>

                <dl className="border-border divide-border my-6 grid border-y text-xs sm:grid-cols-3 sm:divide-x">
                  <div className="py-3 sm:px-4 sm:first:pl-0">
                    <dt className="text-muted-foreground mb-1 uppercase tracking-wider">
                      {t('model')}
                    </dt>
                    <dd className="font-mono">{card.defaultModel}</dd>
                  </div>
                  <div className="border-border border-t py-3 sm:border-t-0 sm:px-4">
                    <dt className="text-muted-foreground mb-1 uppercase tracking-wider">
                      {t('provider')}
                    </dt>
                    <dd className="font-mono">{card.defaultProvider}</dd>
                  </div>
                  <div className="border-border border-t py-3 sm:border-t-0 sm:px-4 sm:last:pr-0">
                    <dt className="text-muted-foreground mb-1 uppercase tracking-wider">
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
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="border-border text-muted-foreground border-t pt-6 text-xs">
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
