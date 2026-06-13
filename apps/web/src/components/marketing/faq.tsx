import { ChevronRight } from 'lucide-react';
import { GITHUB_URL, SectionHeader, Shell } from './primitives';

/**
 * FAQ — native <details>/<summary> so it works with JavaScript disabled.
 * The same data feeds the FAQPage JSON-LD emitted below.
 *
 * Copy is kept deliberately honest: AI responses and the MCP/API-key path are
 * still landing, so we say "preview" rather than overclaim. Don't gloss this.
 */
export const faqItems = [
  {
    question: 'Is TaskNebula really free, and really MIT?',
    answer:
      'Yes — the whole app is MIT licensed: boards, sprints, docs, analytics, the AI surfaces, and the MCP server. No open-core split, no paywalled tier, no per-seat fee. Self-host it and run it forever for unlimited users; fork it if you want to.',
  },
  {
    question: 'Can I self-host it?',
    answer:
      'That is the default. Bring Docker and you get three containers — Postgres 16 with pgvector, Redis 7, and the neuraparse/tasknebula web image. Migrations run on boot, GET /api/health is your probe endpoint, and a one-line compose quickstart gets you to localhost:3000. There is no hosted-only feature you lose by running it yourself.',
  },
  {
    question: 'Do I need the AI features? Can I bring my own keys?',
    answer:
      'AI is optional — every board, sprint, and doc works with no model keys configured. When you want it, you bring your own OpenAI or Anthropic key (set as env vars), so spend and data residency stay yours. There is a cost guard so a runaway prompt cannot run up your bill.',
  },
  {
    question: 'How real are the AI features today?',
    answer:
      'We build them in the open. The data model and endpoints — triage suggestions, pgvector semantic search, and the /api/ask RAG endpoint — are live, and they make real OpenAI and Anthropic calls. Some surfaces are still labeled preview while we harden them; we would rather say that here than have you discover it after install.',
  },
  {
    question: 'What is the MCP server?',
    answer:
      'An MCP (Model Context Protocol) server that exposes TaskNebula as tools — create, search, move, and comment on issues — so agents like Claude Code and Cursor can drive your tracker. It ships with the repo (HTTP at /api/mcp, or stdio via @tasknebula/mcp-server) and is MIT licensed. Heads up: end-to-end agent auth depends on the REST API accepting API keys, which is still being wired, so treat it as preview today.',
  },
  {
    question: 'Does it import from Jira or Linear?',
    answer:
      'Yes — there are importers for Jira, Linear, GitHub, and CSV. Each runs with a preview step so you can inspect the field mapping before anything is written, and you can keep your old tool read-only while you cut over.',
  },
  {
    question: 'Is it production-ready?',
    answer:
      'The core tracker — issues, boards, sprints, docs, search, permissions, REST API, and OpenAPI spec — is solid and self-hostable. Some edges are still maturing: OAuth login needs a DB adapter (use credentials auth for now), realtime collab env vars are not yet plumbed into the Docker images, and parts of the AI/MCP surface are preview. We track all of it openly in docs/STATUS.md.',
  },
  {
    question: 'Who can see my data?',
    answer:
      'You decide. Self-hosted, everything lives in your Postgres on your infrastructure and exports with a plain pg_dump — no telemetry phones home. Inside the product, workspaces are isolated per organization with role-based access, permission schemes, and audit logs.',
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker="FAQ"
          kickerAccentVar="var(--landing-accent-violet)"
          title="Fair questions, straight answers."
          description="No sales gate, no asterisks. If yours is missing, open a GitHub issue — public answers beat private threads."
          compact
        />

        <div className="mt-10 max-w-3xl divide-y divide-[var(--landing-border)] rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)]">
          {faqItems.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-[15px] font-[440] text-[var(--landing-text-dark)] transition-colors duration-150 hover:bg-[var(--landing-bg-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="ease-snap h-4 w-4 shrink-0 text-[var(--landing-text-muted)] transition-transform duration-150 group-open:rotate-90"
                  aria-hidden="true"
                />
                {item.question}
              </summary>
              <p className="landing-body px-5 pb-5 pl-12 text-[14px] text-[var(--landing-text-subtle)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <p className="landing-body mt-6 max-w-3xl text-[13px] text-[var(--landing-text-muted)]">
          Still unsure?{' '}
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-[var(--landing-text-body)] underline decoration-[var(--landing-border-light)] underline-offset-2 transition-colors duration-150 hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
          >
            Ask on GitHub
          </a>{' '}
          or read the live status in the docs.
        </p>
      </Shell>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
      />
    </section>
  );
}
