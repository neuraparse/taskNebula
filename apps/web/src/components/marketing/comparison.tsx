import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { SectionHeader, Shell } from './primitives';

/**
 * Honest 4-way comparison built to convert switchers from Jira / Linear / Plane.
 *
 * Every cell is a verifiable, public claim — vendor facts reflect public docs
 * and pricing pages as of June 2026 (see footnote). TaskNebula's own column uses
 * `yes | partial | no` markers (icon + text, never color alone) so the table is
 * readable for screen readers and color-blind users. We intentionally do NOT
 * mark anything still in flight as done (e.g. OAuth/SSO, row-level security).
 */

type Mark = 'yes' | 'partial' | 'no';
type ProductKey = 'tasknebula' | 'jira' | 'linear' | 'plane';

type Cell = { mark: Mark };

type Row = {
  key: string;
  tasknebula: Cell;
  jira: Cell;
  linear: Cell;
  plane: Cell;
};

const rows: readonly Row[] = [
  {
    key: 'openSource',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'no' },
    linear: { mark: 'no' },
    plane: { mark: 'partial' },
  },
  {
    key: 'selfHost',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'no' },
    linear: { mark: 'no' },
    plane: { mark: 'yes' },
  },
  {
    key: 'price',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'partial' },
    linear: { mark: 'partial' },
    plane: { mark: 'partial' },
  },
  {
    key: 'aiAgents',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'partial' },
    linear: { mark: 'partial' },
    plane: { mark: 'partial' },
  },
  {
    key: 'keyboard',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'partial' },
    linear: { mark: 'yes' },
    plane: { mark: 'yes' },
  },
  {
    key: 'realtime',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'partial' },
    linear: { mark: 'yes' },
    plane: { mark: 'yes' },
  },
  {
    key: 'import',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'partial' },
    linear: { mark: 'yes' },
    plane: { mark: 'yes' },
  },
  {
    key: 'sprints',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'yes' },
    linear: { mark: 'yes' },
    plane: { mark: 'yes' },
  },
  {
    key: 'structure',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'yes' },
    linear: { mark: 'partial' },
    plane: { mark: 'partial' },
  },
  {
    key: 'api',
    tasknebula: { mark: 'yes' },
    jira: { mark: 'partial' },
    linear: { mark: 'partial' },
    plane: { mark: 'partial' },
  },
] as const;

const markMeta: Record<Mark, { accentVar: string }> = {
  yes: { accentVar: 'var(--landing-accent-emerald)' },
  partial: { accentVar: 'var(--landing-accent-amber)' },
  no: { accentVar: 'var(--landing-text-muted)' },
};

function MarkGlyph({ mark }: { mark: Mark }) {
  const { accentVar } = markMeta[mark];

  if (mark === 'yes') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke={accentVar}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 4.5 6.5 11.5 3 8" />
      </svg>
    );
  }

  if (mark === 'partial') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke={accentVar}
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 2" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke={accentVar}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8h8" />
    </svg>
  );
}

function CompareCell({
  cell,
  rowKey,
  productKey,
  highlight = false,
}: {
  cell: Cell;
  rowKey: string;
  productKey: ProductKey;
  highlight?: boolean;
}) {
  const t = useTranslations('publicPages.landing.comparison');
  const label = t(`marks.${cell.mark}`);

  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">
        <MarkGlyph mark={cell.mark} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="sr-only">{label}: </span>
        <span
          className={`text-[13px] leading-5 ${
            highlight ? 'text-[var(--landing-text)]' : 'text-[var(--landing-text-subtle)]'
          }`}
        >
          {t(`rows.${rowKey}.notes.${productKey}`)}
        </span>
      </span>
    </div>
  );
}

function ColHeader({
  name,
  highlight = false,
  accentVar,
}: {
  name: string;
  highlight?: boolean;
  accentVar?: string;
}): ReactNode {
  return (
    <th
      scope="col"
      className={`px-5 py-4 text-[13px] ${
        highlight
          ? 'font-[520] text-[var(--landing-text-dark)]'
          : 'font-[440] text-[var(--landing-text-body)]'
      }`}
    >
      {highlight && accentVar ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accentVar }}
            aria-hidden="true"
          />
          {name}
        </span>
      ) : (
        name
      )}
    </th>
  );
}

function MobileComparisonCards() {
  const t = useTranslations('publicPages.landing.comparison');
  const products = [
    { key: 'tasknebula', name: 'TaskNebula', highlight: true },
    { key: 'jira', name: 'Jira', highlight: false },
    { key: 'linear', name: 'Linear', highlight: false },
    { key: 'plane', name: 'Plane', highlight: false },
  ] as const satisfies readonly {
    key: keyof Pick<Row, 'tasknebula' | 'jira' | 'linear' | 'plane'>;
    name: string;
    highlight?: boolean;
  }[];

  return (
    <div className="mt-10 space-y-3 md:hidden">
      {rows.map((row) => (
        <article
          key={row.key}
          className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] p-4"
        >
          <h3 className="text-[13px] font-[520] text-[var(--landing-text-dark)]">
            {t(`rows.${row.key}.feature`)}
          </h3>
          <dl className="mt-3 space-y-3">
            {products.map((product) => (
              <div key={product.key} className="grid gap-1">
                <dt
                  className={`text-[11px] font-[500] uppercase tracking-[0.14em] ${
                    product.highlight
                      ? 'text-[var(--landing-accent-blue)]'
                      : 'text-[var(--landing-text-muted)]'
                  }`}
                >
                  {product.name}
                </dt>
                <dd>
                  <CompareCell
                    cell={row[product.key]}
                    rowKey={row.key}
                    productKey={product.key}
                    highlight={product.highlight}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

export function Comparison() {
  const t = useTranslations('publicPages.landing.comparison');

  return (
    <section id="compare" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker={t('kicker')}
          kickerAccentVar="var(--landing-accent-amber)"
          title={t('title')}
          description={t('description')}
        />

        <MobileComparisonCards />

        <div
          tabIndex={0}
          role="region"
          aria-label={t('tableAria')}
          className="mt-10 hidden overflow-x-auto rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] md:block"
        >
          <table className="w-full min-w-[820px] border-collapse text-left">
            <caption className="sr-only">{t('tableCaption')}</caption>
            <thead>
              <tr className="border-b border-[var(--landing-border)]">
                <th
                  scope="col"
                  className="px-5 py-4 text-[11px] font-[500] uppercase tracking-[0.14em] text-[var(--landing-text-muted)]"
                >
                  {t('featureHeader')}
                </th>
                <ColHeader name="TaskNebula" highlight accentVar="var(--landing-accent-blue)" />
                <ColHeader name="Jira" />
                <ColHeader name="Linear" />
                <ColHeader name="Plane" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-[var(--landing-border)] last:border-b-0"
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap px-5 py-4 align-top text-[12px] font-[500] text-[var(--landing-text-subtle)]"
                  >
                    {t(`rows.${row.key}.feature`)}
                  </th>
                  <td className="bg-[var(--landing-bg-surface)] px-5 py-4 align-top">
                    <CompareCell
                      cell={row.tasknebula}
                      rowKey={row.key}
                      productKey="tasknebula"
                      highlight
                    />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CompareCell cell={row.jira} rowKey={row.key} productKey="jira" />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CompareCell cell={row.linear} rowKey={row.key} productKey="linear" />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <CompareCell cell={row.plane} rowKey={row.key} productKey="plane" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {(['yes', 'partial', 'no'] as const).map((mark) => (
            <span key={mark} className="inline-flex items-center gap-2">
              <MarkGlyph mark={mark} />
              <span className="text-[12px] text-[var(--landing-text-subtle)]">
                {t(`marks.${mark}`)}
              </span>
            </span>
          ))}
        </div>

        <p className="mt-4 text-[11px] leading-5 text-[var(--landing-text-subtle)]">
          {t('footnote')}
        </p>
      </Shell>
    </section>
  );
}
