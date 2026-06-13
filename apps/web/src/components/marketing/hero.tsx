import Link from 'next/link';
import { ArrowRight, Github, Star } from 'lucide-react';
import { CopyButton } from './copy-button';
import { GITHUB_URL, Kicker, Shell, primaryCtaClass, secondaryCtaClass } from './primitives';

const QUICKSTART_COMMAND = [
  'curl -fsSLo compose.yml https://raw.githubusercontent.com/neuraparse/tasknebula/main/docker-compose.desktop.yml',
  'docker compose up -d',
].join('\n');

const heroChips = [
  'Cmd+K everywhere',
  'MCP server built in',
  'Jira & Linear import',
  'Self-host on your Postgres',
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--landing-border)]">
      <div
        className="bg-aurora animate-aurora pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <Shell className="relative py-20 sm:py-28">
        <div className="animate-blur-in max-w-4xl">
          <Kicker label="Open source · MIT · AI-native" accentVar="var(--landing-accent-blue)" />
          <h1 className="landing-display mt-7 max-w-4xl text-balance text-[44px] text-[var(--landing-text-dark)] sm:text-[64px] lg:text-[80px]">
            The project tracker built for teams{' '}
            <span className="text-gradient-primary">and their agents.</span>
          </h1>
          <p className="landing-body mt-6 max-w-2xl text-[16px] text-[var(--landing-text-subtle)] sm:text-[18px]">
            TaskNebula is the open-source, keyboard-first alternative to Jira and Linear. Boards,
            sprints, and docs that run on your own Postgres — with a built-in MCP server so AI
            agents work the backlog right beside your team. MIT licensed, self-host with one Docker
            Compose.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/signup" className={primaryCtaClass}>
              Create a workspace
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryCtaClass}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              View on GitHub
              <Star className="h-3.5 w-3.5 text-[var(--landing-accent-amber)]" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-6 flex max-w-2xl flex-col gap-2">
            <span className="landing-kicker text-[var(--landing-text-muted)]">
              Or self-host in two commands
            </span>
            <div className="landing-terminal flex max-w-full items-center gap-3 py-2 pl-4 pr-2">
              <pre
                tabIndex={0}
                role="region"
                aria-label="Self-host quickstart commands"
                className="scrollbar-none min-w-0 overflow-x-auto font-mono text-[11px] leading-5 text-[var(--landing-text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
              >
                <code>
                  <span className="select-none text-[var(--landing-text-muted)]">$ </span>
                  curl -fsSLo compose.yml
                  https://raw.githubusercontent.com/neuraparse/tasknebula/main/docker-compose.desktop.yml
                  {'\n'}
                  <span className="select-none text-[var(--landing-text-muted)]">$ </span>
                  docker compose up -d
                </code>
              </pre>
              <CopyButton text={QUICKSTART_COMMAND} label="Copy self-host quickstart" />
            </div>
            <p className="text-[12px] text-[var(--landing-text-subtle)]">
              Free forever self-hosted · Three containers: Postgres, Redis, one web image
            </p>
          </div>

          <div className="stagger mt-9 flex flex-wrap items-center gap-2">
            <span className="live-pill">Interactive demo below</span>
            {heroChips.map((chip) => (
              <span key={chip} className="chip-cyan">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </Shell>
    </section>
  );
}
