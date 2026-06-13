import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';
import { Github } from 'lucide-react';
import { DOCKER_HUB_URL, GITHUB_URL, Shell, focusRingClass } from './primitives';

type FooterLink = { label: string; href: string; ext?: boolean };

const columns: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Compare', href: '#compare' },
      { label: 'Self-host', href: '#self-host' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'OpenAPI spec', href: '/openapi.json' },
      { label: 'MCP server', href: `${GITHUB_URL}/tree/main/packages/mcp-server`, ext: true },
      { label: 'Docker Hub', href: DOCKER_HUB_URL, ext: true },
      { label: 'Health endpoint', href: '/api/health' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'GitHub', href: GITHUB_URL, ext: true },
      { label: 'Changelog', href: `${GITHUB_URL}/blob/main/CHANGELOG.md`, ext: true },
      { label: 'Report a bug', href: `${GITHUB_URL}/issues`, ext: true },
      { label: 'Contributing', href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`, ext: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'MIT License', href: `${GITHUB_URL}/blob/main/LICENSE`, ext: true },
      { label: 'Sign in', href: '/auth/signin' },
      { label: 'Create workspace', href: '/auth/signup' },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--landing-border)]">
      <Shell className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <TaskNebulaLogo />
              <div>
                <p className="landing-title text-[15px] text-[var(--landing-text-dark)]">
                  TaskNebula
                </p>
                <p className="text-[11px] text-[var(--landing-text-subtle)]">
                  Open-source project tracking for teams and agents
                </p>
              </div>
            </div>
            <p className="mt-5 text-[12px] leading-5 text-[var(--landing-text-subtle)]">
              Built in the open. Your issues live in your Postgres — and leave whenever you say so.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TaskNebula on GitHub"
              className={`ease-snap mt-5 inline-flex h-[34px] items-center gap-2 rounded-md border border-[var(--landing-border-strong)] px-3 text-[12px] font-[430] text-[var(--landing-text)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--landing-bg-elevated)] ${focusRingClass}`}
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              Star on GitHub
            </a>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="landing-kicker text-[var(--landing-text-subtle)]">{column.title}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={`rounded-sm text-[13px] text-[var(--landing-text-subtle)] transition-colors duration-150 hover:text-[var(--landing-text-dark)] ${focusRingClass}`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--landing-border)] pt-6 text-[12px] text-[var(--landing-text-subtle)]">
          <span>&copy; {new Date().getFullYear()} TaskNebula. Released under the MIT License.</span>
          <span>Jira, Linear, and Plane are trademarks of their respective owners.</span>
        </div>
      </Shell>
    </footer>
  );
}
