/**
 * Public Trust Center page.
 *
 * Statically rendered, public (no auth) — anyone can link to /trust.
 * All content lives in `apps/web/src/config/trust-center.ts` and
 * `apps/web/src/config/sub-processors.ts` so non-engineers can keep it fresh
 * via a single PR.
 *
 * Sections (top to bottom):
 *   1. Intro
 *   2. Compliance badges
 *   3. Sub-processors table
 *   4. Documents (DPA, whitepaper, privacy, terms)
 *   5. Status page link
 *   6. Public incident history (last 90 days)
 *   7. Security contact
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TRUST_CENTER, recentIncidents } from '@/config/trust-center';
import { SUB_PROCESSORS } from '@/config/sub-processors';
import type { ComplianceBadge, PublicIncident } from '@/config/trust-center';

const PUBLISHED_DOCUMENT_ROUTES: ReadonlySet<string> = new Set();

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages');
  return {
    title: t('trustMetaTitle'),
    description: t('trustMetaDescription'),
  };
}

// `force-static` is the default for a server component without dynamic data,
// but we make it explicit so reviewers know this page should never depend on
// per-request state.
export const dynamic = 'force-static';

export default async function TrustCenterPage() {
  const t = await getTranslations('publicPages');
  const incidents = recentIncidents(TRUST_CENTER, 90);
  const sections = [
    { id: 'compliance', label: t('trustSectionCompliance') },
    { id: 'sub-processors', label: t('trustSectionSubProcessors') },
    { id: 'documents', label: t('trustSectionDocuments') },
    { id: 'status', label: t('trustSectionStatus') },
    { id: 'incidents', label: t('trustSectionIncidents') },
    { id: 'contact', label: t('trustSectionSecurityContact') },
  ] as const;
  const complianceStatusLabels = {
    in_progress: t('trustStatusInProgress'),
    achieved: t('trustStatusAchieved'),
    planned: t('trustStatusPlanned'),
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="grid gap-6 border-b pb-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.14em]">
            {t('trustEyebrow')}
          </p>
          <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
            {TRUST_CENTER.intro.title}
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl self-end text-sm leading-7 sm:text-base">
          {TRUST_CENTER.intro.body}
        </p>
      </header>

      <nav aria-label={t('trustEyebrow')} className="border-b py-4">
        <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="hover:text-foreground focus-visible:ring-ring rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section title={t('trustSectionCompliance')} id="compliance">
        <ul className="border-border divide-border divide-y border-y">
          {TRUST_CENTER.compliance.map((badge) => (
            <ComplianceCard
              key={badge.name}
              badge={badge}
              statusLabels={complianceStatusLabels}
              expectedLabel={t('trustExpected')}
            />
          ))}
        </ul>
      </Section>

      <Section title={t('trustSectionSubProcessors')} id="sub-processors">
        <p className="text-muted-foreground mb-6 max-w-2xl text-sm leading-6">
          {t('trustSubProcessorsIntro')}
        </p>

        <dl className="border-border divide-border divide-y border-y sm:hidden">
          {SUB_PROCESSORS.map((sp) => (
            <div key={sp.name} className="py-4">
              <dt className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {sp.url ? (
                  <a
                    href={sp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {sp.name}
                  </a>
                ) : (
                  sp.name
                )}
                {sp.placeholder ? (
                  <span className="bg-muted text-muted-foreground rounded-sm px-1.5 py-0.5 text-[10px] font-medium">
                    {t('trustStatusPlanned')}
                  </span>
                ) : null}
              </dt>
              <dd className="text-muted-foreground mt-2 text-sm leading-6">{sp.purpose}</dd>
              <dd className="text-muted-foreground mt-2 font-mono text-xs">{sp.region}</dd>
            </div>
          ))}
        </dl>

        <div className="border-border hidden overflow-x-auto border-y sm:block">
          <table className="divide-border min-w-full divide-y text-sm">
            <thead>
              <tr>
                <Th>{t('trustColSubProcessor')}</Th>
                <Th>{t('trustColPurpose')}</Th>
                <Th>{t('trustColRegion')}</Th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {SUB_PROCESSORS.map((sp) => (
                <tr key={sp.name}>
                  <Td>
                    {sp.url ? (
                      <a
                        href={sp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground font-medium hover:underline"
                      >
                        {sp.name}
                      </a>
                    ) : (
                      <span className="font-medium">{sp.name}</span>
                    )}
                    {sp.placeholder ? (
                      <span className="bg-muted text-muted-foreground ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-medium">
                        {t('trustStatusPlanned')}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground">{sp.purpose}</Td>
                  <Td className="text-muted-foreground whitespace-nowrap">{sp.region}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t('trustSectionDocuments')} id="documents">
        <ul className="border-border divide-border divide-y border-y">
          {TRUST_CENTER.documents.map((doc) => {
            const isPublished = !doc.placeholder && PUBLISHED_DOCUMENT_ROUTES.has(doc.href);

            return (
              <li key={doc.label}>
                {isPublished ? (
                  <Link
                    href={doc.href}
                    className="hover:bg-muted/40 focus-visible:ring-ring flex items-center justify-between gap-4 rounded-sm py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                  >
                    <span className="text-sm font-medium">{doc.label}</span>
                    <span className="text-muted-foreground text-xs">{t('trustOpen')}</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <span className="text-muted-foreground text-sm font-medium">{doc.label}</span>
                    <span className="text-muted-foreground text-xs">{t('trustComingSoon')}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={t('trustSectionStatus')} id="status">
        <a
          href={TRUST_CENTER.statusPage.href}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-visible:ring-ring decoration-border hover:decoration-foreground inline-flex items-center gap-2 rounded-sm text-sm font-medium underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <span className="bg-success h-2 w-2 rounded-full" aria-hidden />
          {TRUST_CENTER.statusPage.label}
          <span aria-hidden>→</span>
        </a>
      </Section>

      <Section title={t('trustSectionIncidents')} id="incidents">
        {incidents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('trustNoIncidents')}</p>
        ) : (
          <ul className="border-border divide-border divide-y border-y">
            {incidents.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                viewDetailsLabel={t('trustViewDetails')}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('trustSectionSecurityContact')} id="contact">
        <p className="text-muted-foreground text-sm">
          {t.rich('trustSecurityContact', {
            email: TRUST_CENTER.contact.email,
            link: (chunks) => (
              <a
                href={`mailto:${TRUST_CENTER.contact.email}`}
                className="text-foreground font-medium hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </Section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="border-border grid scroll-mt-6 gap-6 border-b py-10 last:border-b-0 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12"
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-muted-foreground px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider first:pl-0 last:pr-0"
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-top first:pl-0 last:pr-0 ${className}`}>{children}</td>;
}

function ComplianceCard({
  badge,
  statusLabels,
  expectedLabel,
}: {
  badge: ComplianceBadge;
  statusLabels: Record<ComplianceBadge['status'], string>;
  expectedLabel: string;
}) {
  const STATUS_TONE: Record<ComplianceBadge['status'], string> = {
    in_progress: 'bg-warning/10 text-warning',
    achieved: 'bg-success/10 text-success',
    planned: 'bg-muted text-muted-foreground',
  };
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="text-sm font-semibold">{badge.name}</span>
        <span
          className={`rounded-sm px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[badge.status]}`}
        >
          {statusLabels[badge.status]}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">{badge.description}</p>
      {badge.expectedAt ? (
        <p className="text-muted-foreground mt-2 text-xs">
          {expectedLabel} {badge.expectedAt}
        </p>
      ) : null}
    </li>
  );
}

function IncidentRow({
  incident,
  viewDetailsLabel,
}: {
  incident: PublicIncident;
  viewDetailsLabel: string;
}) {
  const STATUS_TONE: Record<PublicIncident['status'], string> = {
    investigating: 'bg-destructive/10 text-destructive',
    identified: 'bg-warning/10 text-warning',
    monitoring: 'bg-warning/10 text-warning',
    resolved: 'bg-success/10 text-success',
  };
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{incident.title}</p>
        <span
          className={`shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[incident.status]}`}
        >
          {incident.status}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{incident.date}</p>
      <p className="text-muted-foreground mt-2 text-sm">{incident.summary}</p>
      {incident.href ? (
        <a
          href={incident.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground mt-2 inline-block text-xs font-medium hover:underline"
        >
          {viewDetailsLabel}
        </a>
      ) : null}
    </li>
  );
}
