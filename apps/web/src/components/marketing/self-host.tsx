import { Container, Database, HeartPulse, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CopyButton } from './copy-button';
import { DOCKER_HUB_URL, SectionHeader, Shell } from './primitives';

const QUICKSTART_LINES = [
  'mkdir tasknebula && cd tasknebula',
  'curl -fsSLo compose.yml https://raw.githubusercontent.com/neuraparse/tasknebula/main/docker-compose.desktop.yml',
  'docker compose up -d',
] as const;

const checklist: Array<{ icon: LucideIcon; tone: string; title: string; body: string }> = [
  {
    icon: Database,
    tone: 'blue',
    title: 'One Postgres, one web image',
    body: 'Postgres 16 with the pgvector extension powers search; Redis 7 is along for the ride. No Mongo, no Elastic, no sidecar zoo.',
  },
  {
    icon: Package,
    tone: 'violet',
    title: 'Migrations run on boot',
    body: 'The image applies every database migration at startup. Upgrading is pulling a newer tag and restarting — nothing manual.',
  },
  {
    icon: HeartPulse,
    tone: 'emerald',
    title: 'Health you can probe',
    body: 'GET /api/health returns 200 when the app is ready — wire it to your load balancer, uptime checks, or compose healthcheck.',
  },
  {
    icon: Container,
    tone: 'amber',
    title: 'Pin the version you trust',
    body: 'Set TASKNEBULA_IMAGE=neuraparse/tasknebula:0.4.0 to lock a release, or follow :latest for the bleeding edge.',
  },
];

export function SelfHost() {
  return (
    <section id="self-host" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <SectionHeader
              kicker="Self-host"
              kickerAccentVar="var(--landing-accent-cyan)"
              title="Your work. Your server. Your data."
              description="Three containers and one command. Everything lives in your Postgres, exporting is a pg_dump away, and nothing phones home — no vendor lock-in by design."
              compact
            />
            <div className="stagger mt-8 grid gap-3 sm:grid-cols-2">
              {checklist.map(({ icon: Icon, tone, title, body }) => (
                <div
                  key={title}
                  className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-4"
                >
                  <div className={`icon-tile icon-tile-accent-${tone} h-9 w-9`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-[13px] font-[500] text-[var(--landing-text-dark)]">
                    {title}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-5 text-[var(--landing-text-subtle)]">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-terminal overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--landing-border)] px-4 py-3">
              <span className="font-mono text-[11px] text-[var(--landing-text-subtle)]">
                quickstart — Docker Desktop or any Docker host (~2 min)
              </span>
              <CopyButton text={QUICKSTART_LINES.join('\n')} label="Copy quickstart commands" />
            </div>
            <pre
              tabIndex={0}
              role="region"
              aria-label="Self-host quickstart commands"
              className="scrollbar-none overflow-x-auto p-4 font-mono text-[12px] leading-7 text-[var(--landing-text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
            >
              <code>
                {QUICKSTART_LINES.map((line) => (
                  <span key={line} className="block">
                    <span className="select-none text-[var(--landing-text-muted)]">$ </span>
                    {line}
                  </span>
                ))}
              </code>
            </pre>
            <div className="border-t border-[var(--landing-border)] px-4 py-3">
              <p className="text-[12px] leading-5 text-[var(--landing-text-subtle)]">
                The web image waits for Postgres, runs migrations, then serves on{' '}
                <span className="font-mono text-[var(--landing-text-body)]">
                  http://localhost:3000
                </span>{' '}
                — open it and finish the first-run admin wizard. Image:{' '}
                <a
                  href={DOCKER_HUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm text-[var(--landing-text-body)] underline decoration-[var(--landing-border-light)] underline-offset-2 transition-colors duration-150 hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
                >
                  neuraparse/tasknebula
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </Shell>
    </section>
  );
}
