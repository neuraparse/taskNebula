import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DOCKER_HUB_URL, GITHUB_URL, Shell } from './primitives';

/**
 * Social-proof strip — OSS receipts instead of a logo wall.
 *
 * Every chip is a real, verifiable link (repo, license, registry, spec). No
 * customer logos and no invented counters: the credibility is in the repo, the
 * license, and the fact that your data never leaves your Postgres.
 */
const proofItems: Array<{ labelKey: string; href: string; external: boolean }> = [
  { labelKey: 'sourceGithub', href: GITHUB_URL, external: true },
  {
    labelKey: 'mitLicensed',
    href: `${GITHUB_URL}/blob/main/LICENSE`,
    external: true,
  },
  {
    labelKey: 'dockerImage',
    href: DOCKER_HUB_URL,
    external: true,
  },
  { labelKey: 'openapiSpec', href: '/openapi.json', external: false },
  {
    labelKey: 'mcpServer',
    href: `${GITHUB_URL}/tree/main/packages/mcp-server`,
    external: true,
  },
];

export function ProofStrip() {
  const t = useTranslations('publicPages.landing.proof');

  return (
    <section
      aria-label={t('aria')}
      className="border-y border-[var(--landing-border)] bg-[var(--landing-bg-elevated)]"
    >
      <Shell className="py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-12">
          <div className="flex max-w-lg items-start gap-3">
            <span className="mt-0.5 text-[var(--landing-accent-emerald)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-[500] leading-5 text-[var(--landing-text-dark)]">
                {t('headline')}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--landing-text-subtle)]">
                {t('subline')}
              </p>
            </div>
          </div>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {proofItems.map(({ labelKey, href, external }) => (
              <li key={labelKey} className="border-b border-[var(--landing-border)] pb-2">
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="block rounded-sm text-[12px] font-[450] text-[var(--landing-text-body)] transition-colors duration-150 hover:text-[var(--landing-text-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]"
                >
                  {t(`items.${labelKey}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    </section>
  );
}
