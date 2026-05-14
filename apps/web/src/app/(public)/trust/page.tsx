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
import { TRUST_CENTER, recentIncidents } from '@/config/trust-center';
import { SUB_PROCESSORS } from '@/config/sub-processors';
import type { ComplianceBadge, PublicIncident } from '@/config/trust-center';

export const metadata: Metadata = {
  title: 'Trust Center · TaskNebula',
  description:
    'Security program, sub-processors, compliance status, and recent ' +
    'reliability incidents for TaskNebula.',
};

// `force-static` is the default for a server component without dynamic data,
// but we make it explicit so reviewers know this page should never depend on
// per-request state.
export const dynamic = 'force-static';

export default function TrustCenterPage() {
  const incidents = recentIncidents(TRUST_CENTER, 90);
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-8">
      <header className="mb-12 border-b pb-10">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trust Center
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {TRUST_CENTER.intro.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          {TRUST_CENTER.intro.body}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Last reviewed: {new Date().toISOString().slice(0, 10)}
        </p>
      </header>

      <Section title="Compliance" id="compliance">
        <ul className="grid gap-4 sm:grid-cols-2">
          {TRUST_CENTER.compliance.map((badge) => (
            <ComplianceCard key={badge.name} badge={badge} />
          ))}
        </ul>
      </Section>

      <Section title="Sub-processors" id="sub-processors">
        <p className="mb-5 text-sm text-muted-foreground">
          We use the following sub-processors to run TaskNebula. Material
          changes are announced 30 days before they take effect.
        </p>
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr>
                <Th>Sub-processor</Th>
                <Th>Purpose</Th>
                <Th>Region</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SUB_PROCESSORS.map((sp) => (
                <tr key={sp.name}>
                  <Td>
                    {sp.url ? (
                      <a
                        href={sp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:underline"
                      >
                        {sp.name}
                      </a>
                    ) : (
                      <span className="font-medium">{sp.name}</span>
                    )}
                    {sp.placeholder ? (
                      <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Planned
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground">{sp.purpose}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {sp.region}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Documents" id="documents">
        <ul className="grid gap-3 sm:grid-cols-2">
          {TRUST_CENTER.documents.map((doc) => (
            <li key={doc.label}>
              <Link
                href={doc.href}
                className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="text-sm font-medium">{doc.label}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.placeholder ? 'Coming soon' : 'Open →'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Status & uptime" id="status">
        <a
          href={TRUST_CENTER.statusPage.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/40"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          {TRUST_CENTER.statusPage.label}
          <span aria-hidden>→</span>
        </a>
      </Section>

      <Section title="Recent incidents (last 90 days)" id="incidents">
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No incidents reported in the last 90 days.
          </p>
        ) : (
          <ul className="space-y-3">
            {incidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Security contact" id="contact">
        <p className="text-sm text-muted-foreground">
          Report a vulnerability or ask a security question at{' '}
          <a
            href={`mailto:${TRUST_CENTER.contact.email}`}
            className="font-medium text-foreground hover:underline"
          >
            {TRUST_CENTER.contact.email}
          </a>
          .
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
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function ComplianceCard({ badge }: { badge: ComplianceBadge }) {
  const STATUS_LABEL: Record<ComplianceBadge['status'], string> = {
    in_progress: 'In progress',
    achieved: 'Achieved',
    planned: 'Planned',
  };
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
          {STATUS_LABEL[badge.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{badge.description}</p>
      {badge.expectedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Expected: {badge.expectedAt}
        </p>
      ) : null}
    </li>
  );
}

function IncidentRow({ incident }: { incident: PublicIncident }) {
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
      <p className="mt-1 text-xs text-muted-foreground">{incident.date}</p>
      <p className="mt-2 text-sm text-muted-foreground">{incident.summary}</p>
      {incident.href ? (
        <a
          href={incident.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-foreground hover:underline"
        >
          View details →
        </a>
      ) : null}
    </li>
  );
}
