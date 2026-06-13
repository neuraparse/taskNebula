import { BookOpen, Container, Github, Plug, Scale, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DOCKER_HUB_URL, GITHUB_URL, Shell } from './primitives';

/**
 * Social-proof strip — OSS receipts instead of a logo wall.
 *
 * Every chip is a real, verifiable link (repo, license, registry, spec). No
 * customer logos and no invented counters: the credibility is in the repo, the
 * license, and the fact that your data never leaves your Postgres.
 */
const proofItems: Array<{ icon: LucideIcon; label: string; href: string; external: boolean }> = [
  { icon: Github, label: 'Source on GitHub', href: GITHUB_URL, external: true },
  {
    icon: Scale,
    label: 'MIT licensed',
    href: `${GITHUB_URL}/blob/main/LICENSE`,
    external: true,
  },
  {
    icon: Container,
    label: 'Image on Docker Hub',
    href: DOCKER_HUB_URL,
    external: true,
  },
  { icon: BookOpen, label: 'OpenAPI spec', href: '/openapi.json', external: false },
  {
    icon: Plug,
    label: 'MCP server',
    href: `${GITHUB_URL}/tree/main/packages/mcp-server`,
    external: true,
  },
];

export function ProofStrip() {
  return (
    <section
      aria-label="Open-source credibility"
      className="border-t border-[var(--landing-border)]"
    >
      <Shell className="py-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex items-center gap-3">
            <span className="text-[var(--landing-accent-emerald)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[13px] leading-5 text-[var(--landing-text-body)]">
              <span className="font-[500] text-[var(--landing-text-dark)]">
                Open source, self-hosted, your data stays yours.
              </span>{' '}
              <span className="text-[var(--landing-text-subtle)]">
                No logo wall — just receipts you can check.
              </span>
            </p>
          </div>
          <ul className="flex flex-wrap items-center gap-2">
            {proofItems.map(({ icon: Icon, label, href, external }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="ease-snap group inline-flex items-center gap-2 rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-3 py-1.5 text-[12px] font-[450] text-[var(--landing-text-body)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--landing-border-strong)] hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
                >
                  <Icon
                    className="ease-snap h-3.5 w-3.5 text-[var(--landing-text-icon)] transition-colors duration-150 group-hover:text-[var(--landing-accent-blue)]"
                    aria-hidden="true"
                  />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    </section>
  );
}
