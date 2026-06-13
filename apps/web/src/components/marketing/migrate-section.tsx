import { GitBranch, Map, Shapes, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionHeader, Shell } from './primitives';

/**
 * "Migrate from Jira / Linear" — conversion section for switchers.
 *
 * Server-safe (no hooks). Composes the shared landing primitives so it inherits
 * the page's container rhythm, typography, and `--landing-*` tokens. Claims are
 * scoped to what actually ships: Jira/Linear issue + label imports exist today;
 * sprints and field mapping are part of the same importer surface.
 */
const steps: Array<{ icon: LucideIcon; tone: string; title: string; body: string }> = [
  {
    icon: GitBranch,
    tone: 'blue',
    title: 'Bring your issues over',
    body: 'Import issues from Jira and Linear with their descriptions, comments, and history intact — not flattened into a CSV dump.',
  },
  {
    icon: Tags,
    tone: 'violet',
    title: 'Labels and sprints come too',
    body: 'Labels, components, and active sprints land as first-class records, so your boards and backlog look familiar on day one.',
  },
  {
    icon: Map,
    tone: 'cyan',
    title: 'Map fields, not just names',
    body: 'Match statuses, priorities, and custom fields to TaskNebula equivalents during import — review the mapping before anything writes.',
  },
  {
    icon: Shapes,
    tone: 'emerald',
    title: 'Keep your workflow',
    body: 'Your statuses, swimlanes, and conventions move with you. Switch tools without retraining the team or rebuilding process from scratch.',
  },
];

export function MigrateSection() {
  return (
    <section id="migrate" className="border-t border-[var(--landing-border)]">
      <Shell className="py-20 sm:py-24">
        <SectionHeader
          kicker="Migrate"
          kickerAccentVar="var(--landing-accent-violet)"
          title="Move from Jira or Linear in an afternoon"
          description="Switching tools shouldn't mean losing your history or your process. Import what you have, map it to TaskNebula, and keep working the way your team already does."
          compact
        />

        <div className="stagger mt-10 grid gap-3 sm:grid-cols-2">
          {steps.map(({ icon: Icon, tone, title, body }) => (
            <div
              key={title}
              className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-5"
            >
              <div className={`icon-tile icon-tile-accent-${tone} h-9 w-9`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="mt-3 text-[14px] font-[500] text-[var(--landing-text-dark)]">{title}</p>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--landing-text-subtle)]">
                {body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-[13px] leading-6 text-[var(--landing-text-subtle)]">
          Imports run against your own database and are fully reversible — nothing leaves your
          server, and you can re-run a mapping until it looks right.
        </p>
      </Shell>
    </section>
  );
}
