import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import webPackage from '../../package.json';
import { HeroShowcase } from '@/components/landing/product-showcase';
import { AiMcpSection } from '@/components/marketing/ai-mcp-section';
import { Comparison } from '@/components/marketing/comparison';
import { Faq } from '@/components/marketing/faq';
import { FinalCta } from '@/components/marketing/final-cta';
import { Hero } from '@/components/marketing/hero';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { DOCKER_HUB_URL, GITHUB_URL } from '@/components/marketing/primitives';
import { SelfHost } from '@/components/marketing/self-host';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.landing.meta');
  const title = t('title');
  const description = t('description');

  return {
    metadataBase: new URL(APP_URL),
    title,
    description,
    alternates: { canonical: '/' },
    keywords: [
      'open source project management',
      'Jira alternative',
      'Linear alternative',
      'self-hosted issue tracker',
      'MCP server',
      'kanban',
      'sprints',
    ],
    openGraph: {
      type: 'website',
      url: '/',
      siteName: 'TaskNebula',
      title,
      description,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

/**
 * Landing page. Thin composition: every section lives in src/components/marketing/,
 * with a small client island only for clipboard behavior.
 */
export default async function HomePage() {
  const t = await getTranslations('publicPages.landing.meta');
  const softwareApplicationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TaskNebula',
    description: t('description'),
    url: APP_URL,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Project Management',
    operatingSystem: 'Linux, Docker',
    softwareVersion: webPackage.version,
    license: `${GITHUB_URL}/blob/main/LICENSE`,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    sameAs: [GITHUB_URL, DOCKER_HUB_URL],
  } as const;

  return (
    <div className="landing-dark min-h-screen overflow-x-hidden bg-[var(--landing-bg)] text-[var(--landing-text)] antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--landing-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--landing-text-dark)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--landing-accent-blue)]"
      >
        {t('skipToContent')}
      </a>

      <MarketingNav />

      <main id="main-content">
        <Hero />
        <HeroShowcase />
        <AiMcpSection />
        <SelfHost />
        <Comparison />
        <Faq />
        <FinalCta />
      </main>

      <MarketingFooter />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
    </div>
  );
}
