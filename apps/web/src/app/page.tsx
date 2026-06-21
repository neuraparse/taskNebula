import type { Metadata } from 'next';
import { HeroShowcase } from '@/components/landing/product-showcase';
import { AiMcpSection } from '@/components/marketing/ai-mcp-section';
import { Comparison } from '@/components/marketing/comparison';
import { Faq } from '@/components/marketing/faq';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { FinalCta } from '@/components/marketing/final-cta';
import { Hero } from '@/components/marketing/hero';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MigrateSection } from '@/components/marketing/migrate-section';
import { DOCKER_HUB_URL, GITHUB_URL } from '@/components/marketing/primitives';
import { ProofStrip } from '@/components/marketing/proof-strip';
import { SelfHost } from '@/components/marketing/self-host';
import { WorkflowNarrative } from '@/components/marketing/workflow-narrative';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const PAGE_TITLE = 'TaskNebula — Open-source, AI-native Jira & Linear alternative';
const PAGE_DESCRIPTION =
  'Keyboard-first boards, sprints, and docs with an MCP server so AI agents work the backlog with you. MIT licensed — self-host with one Docker Compose file.';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TaskNebula',
  description: PAGE_DESCRIPTION,
  url: APP_URL,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Project Management',
  operatingSystem: 'Linux, Docker',
  softwareVersion: '0.4.0',
  license: `${GITHUB_URL}/blob/main/LICENSE`,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  sameAs: [GITHUB_URL, DOCKER_HUB_URL],
} as const;

/**
 * Landing page — un-localized root route (see middleware.ts), English-only by
 * design. Thin composition: every section lives in src/components/marketing/,
 * all server components except the copy buttons and the interactive board demo.
 */
export default function HomePage() {
  return (
    <div className="landing-dark min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--landing-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--landing-text-dark)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--landing-accent-blue)]"
      >
        Skip to content
      </a>

      <MarketingNav />

      <main id="main-content">
        <Hero />
        <HeroShowcase />
        <ProofStrip />
        <FeatureGrid />
        <WorkflowNarrative />
        <AiMcpSection />
        <Comparison />
        <MigrateSection />
        <SelfHost />
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
