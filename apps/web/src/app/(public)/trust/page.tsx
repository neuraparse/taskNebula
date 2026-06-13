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
  const complianceStatusLabels = {
    in_progress: t('trustStatusInProgress'),
    achieved: t('trustStatusAchieved'),
    planned: t('trustStatusPlanned'),
  };
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-8">
      <header className="mb-12 border-b pb-10">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {t('trustEyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{TRUST_CENTER.intro.title}</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-base">{TRUST_CENTER.intro.body}</p>
        <p className="text-muted-foreground mt-3 text-xs">
          {t('trustLastReviewed', { date: new Date().toISOString().slice(0, 10) })}
        </p>
      </header>

      <Section title={t('trustSectionCompliance')} id="compliance">
        <ul className="grid gap-4 sm:grid-cols-2">
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
        <p className="text-muted-foreground mb-5 text-sm">{t('trustSubProcessorsIntro')}</p>
        <div className="overflow-hidden rounded-lg border">
          <table className="divide-border min-w-full divide-y text-sm">
            <thead className="bg-muted/40">
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
                      <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {TRUST_CENTER.documents.map((doc) => (
            <li key={doc.label}>
              <Link
                href={doc.href}
                className="hover:bg-muted/40 flex items-center justify-between rounded-md border px-4 py-3 transition-colors"
              >
                <span className="text-sm font-medium">{doc.label}</span>
                <span className="text-muted-foreground text-xs">
                  {doc.placeholder ? t('trustComingSoon') : t('trustOpen')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('trustSectionStatus')} id="status">
        <a
          href={TRUST_CENTER.statusPage.href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-muted/40 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          {TRUST_CENTER.statusPage.label}
          <span aria-hidden>→</span>
        </a>
      </Section>

      <Section title={t('trustSectionIncidents')} id="incidents">
        {incidents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('trustNoIncidents')}</p>
        ) : (
          <ul className="space-y-3">
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
    <section id={id} className="mb-14">
      <h2 className="mb-5 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
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
    in_progress: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    achieved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    planned: 'bg-muted text-muted-foreground',
  };
  return (
    <li className="rounded-lg border p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{badge.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[badge.status]}`}
        >
          {statusLabels[badge.status]}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">{badge.description}</p>
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
    investigating: 'bg-red-500/10 text-red-600 dark:text-red-400',
    identified: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    monitoring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };
  return (
    <li className="rounded-md border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{incident.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[incident.status]}`}
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
