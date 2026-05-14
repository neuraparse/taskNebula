/**
 * Trust Center content config.
 *
 * Drives the public `/trust` page. Edit this file to update badges, links,
 * and incident history — no template changes required.
 *
 * Why a config file (and not a CMS)? Trust center content evolves slowly
 * and needs change history; checking it into the repo gives reviewers a
 * clean PR-based audit trail.
 */

export interface ComplianceBadge {
  name: string;
  status: 'in_progress' | 'achieved' | 'planned';
  description: string;
  // ISO date when the next milestone is expected (optional).
  expectedAt?: string;
}

export interface TrustDocument {
  label: string;
  href: string;
  /** True for a generated PDF placeholder; UI shows a "Coming soon" pill. */
  placeholder?: boolean;
}

export interface PublicIncident {
  id: string;
  // ISO date.
  date: string;
  title: string;
  /** Plain-text summary suitable for inline rendering. */
  summary: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  /** Optional link to the status page entry. */
  href?: string;
}

export interface TrustCenterConfig {
  intro: {
    title: string;
    body: string;
  };
  compliance: ComplianceBadge[];
  documents: TrustDocument[];
  statusPage: {
    label: string;
    href: string;
  };
  /** Only incidents from the last 90 days are surfaced by the page logic. */
  incidents: PublicIncident[];
  /** Contact for security questions / vulnerability reports. */
  contact: {
    email: string;
    pgpUrl?: string;
  };
}

export const TRUST_CENTER: TrustCenterConfig = {
  intro: {
    title: 'Trust at TaskNebula',
    body:
      'TaskNebula is built for teams that need visibility into how their data ' +
      'is handled. This page lists our security program, sub-processors, ' +
      'compliance status, and a 90-day window into reliability incidents.',
  },
  compliance: [
    {
      name: 'SOC 2 Type II',
      status: 'in_progress',
      description:
        'Type II observation window is in progress with an independent auditor. ' +
        'Report available under NDA on request.',
      expectedAt: '2026-09-01',
    },
    {
      name: 'ISO/IEC 27001',
      status: 'planned',
      description:
        'Implementation of the ISMS is scheduled to begin after SOC 2 Type II ' +
        'completes. We will publish stage updates as gates are cleared.',
      expectedAt: '2027-03-01',
    },
    {
      name: 'GDPR / UK GDPR',
      status: 'achieved',
      description:
        'Standard contractual clauses and a Data Processing Addendum (DPA) ' +
        'are available for download below. EU and UK data subject requests ' +
        'are honored within statutory deadlines.',
    },
  ],
  documents: [
    {
      label: 'Data Processing Addendum (DPA)',
      href: '/legal/dpa.pdf',
      placeholder: true,
    },
    {
      label: 'Security Whitepaper',
      href: '/legal/security-whitepaper.pdf',
      placeholder: true,
    },
    {
      label: 'Privacy Policy',
      href: '/legal/privacy',
    },
    {
      label: 'Terms of Service',
      href: '/legal/terms',
    },
  ],
  statusPage: {
    label: 'TaskNebula Status',
    href: 'https://status.tasknebula.com',
  },
  incidents: [
    {
      id: 'inc-2026-04-22',
      date: '2026-04-22',
      title: 'Degraded notification delivery (15 min)',
      summary:
        'Transactional email delivery was degraded for ~15 minutes during a ' +
        'maintenance window at our primary email sub-processor. No data loss; ' +
        'retries succeeded automatically.',
      status: 'resolved',
      href: 'https://status.tasknebula.com/incidents/inc-2026-04-22',
    },
    {
      id: 'inc-2026-03-08',
      date: '2026-03-08',
      title: 'Realtime presence latency spike',
      summary:
        'Brief latency spike (~30 s) on the realtime channel during a regional ' +
        'failover. No data integrity impact.',
      status: 'resolved',
      href: 'https://status.tasknebula.com/incidents/inc-2026-03-08',
    },
  ],
  contact: {
    email: 'security@tasknebula.com',
  },
};

/**
 * Filter incidents to the last `days` days (default 90). Pure helper so the
 * page can render server-side without any extra logic.
 */
export function recentIncidents(
  cfg: TrustCenterConfig = TRUST_CENTER,
  days = 90,
  now: Date = new Date()
): PublicIncident[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return cfg.incidents.filter((incident) => {
    const t = Date.parse(incident.date);
    return Number.isFinite(t) && t >= cutoff;
  });
}
