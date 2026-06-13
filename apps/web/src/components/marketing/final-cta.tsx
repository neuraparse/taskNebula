import Link from 'next/link';
import { ArrowRight, Github } from 'lucide-react';
import { CopyButton } from './copy-button';
import { GITHUB_URL, Kicker, Shell, primaryCtaClass, secondaryCtaClass } from './primitives';

const QUICKSTART_ONE_LINER = 'docker compose up -d';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--landing-border)]">
      <div
        className="bg-aurora animate-aurora pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      />
      <Shell className="relative py-20 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker label="Get started" accentVar="var(--landing-accent-emerald)" center />
          <h2 className="landing-display mt-6 text-balance text-[36px] text-[var(--landing-text-dark)] sm:text-[48px] lg:text-[60px]">
            Own your tracker. <span className="text-gradient-primary">Bring your agents.</span>
          </h2>
          <p className="landing-body mx-auto mt-5 max-w-xl text-[15px] text-[var(--landing-text-subtle)]">
            Create a workspace in minutes, or run the whole thing on your own box tonight — either
            way, the code is yours to read.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/signup" className={primaryCtaClass}>
              Create a workspace
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#self-host" className={secondaryCtaClass}>
              Self-host quickstart
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryCtaClass}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              Read the source
            </a>
          </div>
          <div className="mx-auto mt-8 flex max-w-md items-center justify-between gap-3 rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-3 py-2">
            <code className="truncate font-mono text-[12px] text-[var(--landing-text-body)]">
              <span className="select-none text-[var(--landing-text-muted)]">$ </span>
              {QUICKSTART_ONE_LINER}
            </code>
            <CopyButton text={QUICKSTART_ONE_LINER} label="Copy docker quickstart command" />
          </div>
          <p className="mt-3 text-[12px] text-[var(--landing-text-subtle)]">
            No credit card. No telemetry by default. Export with a{' '}
            <span className="font-mono text-[var(--landing-text-body)]">pg_dump</span> whenever you
            leave.
          </p>
        </div>
      </Shell>
    </section>
  );
}
