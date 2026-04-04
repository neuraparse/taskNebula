import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Github,
  Keyboard,
  Shield,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import {
  AnalyticsShowcase,
  HeroShowcase,
  SprintShowcase,
  TeamShowcase,
  WorkflowShowcase,
} from '@/components/landing/product-showcase';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';

const navItems = [
  { label: 'Board', href: '#board' },
  { label: 'Product', href: '#product' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
] as const;

const heroSignals = [
  'Docs linked to tasks',
  'Custom workflows and rules',
  'Self-hosted with Docker',
] as const;

const launchRows = [
  { label: 'Boards', value: 'Backlog, triage, sprint flow' },
  { label: 'Docs', value: 'Specs, sub-notes, revisions' },
  { label: 'Control', value: 'Permissions, audit, admin' },
] as const;

const capabilities: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
}> = [
  {
    icon: Workflow,
    title: 'Run delivery in one place',
    body: 'Backlog, board, sprint, and roadmap stay in the same surface.',
    accent: 'var(--landing-accent-blue)',
  },
  {
    icon: BookOpen,
    title: 'Write next to the work',
    body: 'Docs, notes, revisions, and linked issues live inside the workspace.',
    accent: 'var(--landing-accent-green)',
  },
  {
    icon: Shield,
    title: 'Keep control close',
    body: 'Settings, permissions, API keys, webhooks, and audit stay readable.',
    accent: 'var(--landing-accent-amber)',
  },
];

const pricingPlans = [
  {
    name: 'Community',
    price: 'Free',
    body: 'Full self-hosted core.',
    accent: 'var(--landing-accent-blue)',
    href: '/auth/signup',
    cta: 'Create workspace',
    features: ['Projects, docs, sprints', 'Workflows and permissions', 'GitHub, API keys, webhooks'],
  },
  {
    name: 'Growth',
    price: 'Soon',
    body: 'More automation and reporting.',
    accent: 'var(--landing-accent-green)',
    href: '/auth/signup',
    cta: 'Join waitlist',
    highlighted: true,
    features: ['Everything in Community', 'Expanded AI assistance', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    body: 'Rollout and governance support.',
    accent: 'var(--landing-accent-amber)',
    href: '/auth/signup',
    cta: 'Talk to us',
    features: ['Everything in Growth', 'Custom deployment path', 'Dedicated success support'],
  },
] as const;

export default function HomePage() {
  return (
    <div className="landing-dark min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] antialiased">
      <nav className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-bg)_97%,black)]">
        <Shell className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="TaskNebula home">
            <TaskNebulaLogo className="shrink-0" />
            <div className="flex flex-col">
              <span className="landing-title text-[15px] text-[var(--landing-text-dark)]">TaskNebula</span>
              <span className="hidden text-[11px] text-[var(--landing-text-muted)] sm:block">
                Self-hosted project operating system
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-sm px-3 py-2 text-[13px] text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text-dark)]"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="inline-flex h-10 items-center rounded-sm border border-[var(--landing-border-strong)] px-3.5 text-[13px] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-10 items-center gap-2 rounded-sm border border-white bg-white px-4 text-[13px] font-medium text-black transition-colors hover:border-[#dddddd] hover:bg-[#dddddd]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Shell>
      </nav>

      <main id="main-content">
        <section className="border-b border-[var(--landing-border)]">
          <Shell className="relative py-16 sm:py-20 lg:py-24">
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1.08fr)_360px] xl:items-start">
              <div className="max-w-4xl">
                <SectionBadge color="var(--landing-accent-blue)" label="Open source • docs-native • self-hosted" />
                <h1 className="landing-display mt-7 max-w-4xl text-balance text-[46px] text-[var(--landing-text-dark)] sm:text-[64px] lg:text-[84px]">
                  Project operations, without the sprawl.
                </h1>
                <p className="landing-body mt-6 max-w-2xl text-[16px] text-[var(--landing-text-subtle)] sm:text-[18px]">
                  Boards, docs, workflows, analytics, and admin control in one stable workspace.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth/signup"
                    className="inline-flex h-11 items-center gap-2 rounded-sm border border-white bg-white px-4 text-sm font-medium text-black transition-colors hover:border-[#dddddd] hover:bg-[#dddddd]"
                  >
                    Start with Community
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="https://github.com/neuraparse/tasknebula"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-sm border border-[var(--landing-border-strong)] px-4 text-sm text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]"
                  >
                    <Github className="h-4 w-4" />
                    View source
                  </a>
                </div>

                <div className="mt-9 flex flex-wrap gap-3">
                  {heroSignals.map((signal) => (
                    <div
                      key={signal}
                      className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg-card)] px-3.5 py-2 text-[12px] text-[var(--landing-text-muted)]"
                    >
                      {signal}
                    </div>
                  ))}
                </div>
              </div>

              <SurfacePanel className="overflow-hidden p-0">
                <div className="border-b border-[var(--landing-border)] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <TaskNebulaLogo compact />
                    <div>
                      <p className="text-[13px] font-medium text-[var(--landing-text-dark)]">Community includes</p>
                      <p className="text-[11px] text-[var(--landing-text-muted)]">The full operating surface</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 px-5 py-5">
                  <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-4 py-3">
                    <p className="landing-kicker text-[var(--landing-text-muted)]">Deploy</p>
                    <code className="mt-2 block overflow-x-auto whitespace-nowrap font-mono text-[12px] text-[var(--landing-text-subtle)]">
                      docker pull neuraparse/tasknebula
                    </code>
                  </div>

                  {launchRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-start gap-4 rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-4 py-4"
                    >
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--landing-accent-blue)]" />
                      <div>
                        <p className="text-[13px] font-medium text-[var(--landing-text-dark)]">{row.label}</p>
                        <p className="mt-1 text-[13px] leading-6 text-[var(--landing-text-muted)]">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SurfacePanel>
            </div>
          </Shell>
        </section>

        <HeroShowcase />

        <section id="product" className="border-t border-[var(--landing-border)]">
          <Shell className="py-16 sm:py-20 lg:py-24">
            <SectionHeader
              badge="Product"
              badgeColor="var(--landing-accent-green)"
              title="Built to stay clear as the workspace grows."
              description="Less noise, tighter surfaces, and one product language across execution, docs, and control."
            />

            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {capabilities.map((item) => (
                <CapabilityPanel key={item.title} {...item} />
              ))}
            </div>

            <div className="mt-14 space-y-14">
              <ShowcaseRow
                eyebrow="Team"
                title="People and activity stay visible."
                description="Presence and movement read like context, not clutter."
              >
                <TeamShowcase />
              </ShowcaseRow>

              <ShowcaseRow
                eyebrow="Workflow"
                title="Process stays editable."
                description="Statuses, transitions, rules, and sprint rhythm stay in one system."
                reverse
              >
                <WorkflowShowcase />
              </ShowcaseRow>

              <div className="grid gap-6 xl:grid-cols-2">
                <CompactShowcase title="Sprint view" body="Planning remains readable.">
                  <SprintShowcase />
                </CompactShowcase>
                <CompactShowcase title="Analytics" body="Signals stay close to execution.">
                  <AnalyticsShowcase />
                </CompactShowcase>
              </div>
            </div>
          </Shell>
        </section>

        <section id="security" className="border-t border-[var(--landing-border)]">
          <Shell className="py-16 sm:py-20 lg:py-24">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_360px]">
              <SurfacePanel className="p-6 sm:p-8">
                <SectionHeader
                  badge="Security"
                  badgeColor="var(--landing-accent-blue)"
                  title="Control surfaces stay inside the product."
                  description="Permissions, API keys, webhooks, audit, and admin settings keep the same calm language."
                  compact
                />

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <MiniFeature icon={Shield} title="Role-based access" />
                  <MiniFeature icon={Sparkles} title="Automation and rules" />
                  <MiniFeature icon={Keyboard} title="Keyboard-first flow" />
                  <MiniFeature icon={Users} title="Admin and team controls" />
                </div>
              </SurfacePanel>

              <SurfacePanel className="p-6">
                <p className="landing-kicker text-[var(--landing-text-muted)]">Why teams self-host</p>
                <ul className="mt-5 space-y-3">
                  {['MIT licensed', 'Docker-first', 'Postgres + Redis ready', 'Your infra, your data'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[var(--landing-text)]">
                      <div className="h-2 w-2 rounded-full bg-[var(--landing-accent-amber)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </SurfacePanel>
            </div>
          </Shell>
        </section>

        <section id="pricing" className="border-t border-[var(--landing-border)]">
          <Shell className="py-16 sm:py-20 lg:py-24">
            <SectionHeader
              badge="Pricing"
              badgeColor="var(--landing-accent-pink)"
              title="Strong free core. Extra layers only when needed."
              description="The open-source base is the product, not a teaser."
            />

            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>
          </Shell>
        </section>

        <section className="border-t border-[var(--landing-border)]">
          <Shell className="py-16 sm:py-20 lg:py-24">
            <SurfacePanel className="px-6 py-10 text-center sm:px-10 sm:py-14">
              <SectionBadge color="var(--landing-accent-green)" label="Ready to launch" />
              <h2 className="landing-display mx-auto mt-5 max-w-3xl text-balance text-[36px] text-[var(--landing-text-dark)] sm:text-[48px] lg:text-[60px]">
                Ship from one calmer workspace.
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/auth/signup"
                  className="inline-flex h-11 items-center gap-2 rounded-sm border border-white bg-white px-4 text-sm font-medium text-black transition-colors hover:border-[#dddddd] hover:bg-[#dddddd]"
                >
                  Create workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/neuraparse/tasknebula"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-sm border border-[var(--landing-border-strong)] px-4 text-sm text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]"
                >
                  <Github className="h-4 w-4" />
                  Explore repo
                </a>
              </div>
            </SurfacePanel>
          </Shell>
        </section>
      </main>

      <footer className="border-t border-[var(--landing-border)]">
        <Shell className="py-10">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <TaskNebulaLogo />
                <div>
                  <p className="landing-title text-[15px] text-[var(--landing-text-dark)]">TaskNebula</p>
                  <p className="text-[11px] text-[var(--landing-text-muted)]">Self-hosted project operating system</p>
                </div>
              </div>
            </div>

            <FooterColumn
              title="Product"
              links={[
                { label: 'Product', href: '#product' },
                { label: 'Security', href: '#security' },
                { label: 'Pricing', href: '#pricing' },
              ]}
            />
            <FooterColumn
              title="Open source"
              links={[
                { label: 'GitHub', href: 'https://github.com/neuraparse/tasknebula', ext: true },
                { label: 'Docker Hub', href: 'https://hub.docker.com/r/neuraparse/tasknebula', ext: true },
                { label: 'Get started', href: '/auth/signup' },
              ]}
            />
          </div>

          <div className="mt-10 border-t border-[var(--landing-border)] pt-6 text-[12px] text-[var(--landing-text-muted)]">
            &copy; {new Date().getFullYear()} TaskNebula. MIT licensed.
          </div>
        </Shell>
      </footer>
    </div>
  );
}

function Shell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-screen-xl px-4 sm:px-8 lg:px-20 ${className}`}>{children}</div>;
}

function SectionBadge({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-sm border border-[var(--landing-border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, var(--landing-bg-card))`, color }}
    >
      <div className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </div>
  );
}

function SectionHeader({
  badge,
  badgeColor,
  title,
  description,
  compact = false,
}: {
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'max-w-2xl' : 'max-w-3xl'}>
      <SectionBadge color={badgeColor} label={badge} />
      <h2
        className={`landing-title mt-5 text-balance text-[var(--landing-text-dark)] ${
          compact ? 'text-[30px] sm:text-[36px]' : 'text-[34px] sm:text-[42px] lg:text-[52px]'
        }`}
      >
        {title}
      </h2>
      <p className="landing-body mt-4 max-w-2xl text-[15px] text-[var(--landing-text-subtle)] sm:text-[16px]">
        {description}
      </p>
    </div>
  );
}

function SurfacePanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)] ${className}`}
    >
      {children}
    </div>
  );
}

function CapabilityPanel({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <SurfacePanel className="h-full p-6">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-md"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, var(--landing-bg-surface))`, color: accent }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="landing-title mt-6 text-[24px] text-[var(--landing-text-dark)]">{title}</h3>
      <p className="landing-body mt-3 text-[14px] text-[var(--landing-text-muted)]">{body}</p>
    </SurfacePanel>
  );
}

function ShowcaseRow({
  eyebrow,
  title,
  description,
  children,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`grid gap-8 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] xl:items-center ${reverse ? 'xl:[&>*:first-child]:order-2 xl:[&>*:last-child]:order-1' : ''}`}>
      <div className="max-w-xl">
        <p className="landing-kicker text-[var(--landing-text-muted)]">{eyebrow}</p>
        <h3 className="landing-title mt-4 text-balance text-[32px] text-[var(--landing-text-dark)] sm:text-[40px]">
          {title}
        </h3>
        <p className="landing-body mt-4 text-[15px] text-[var(--landing-text-subtle)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function CompactShowcase({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="landing-title text-[28px] text-[var(--landing-text-dark)]">{title}</h3>
        <p className="landing-body mt-2 text-[14px] text-[var(--landing-text-muted)]">{body}</p>
      </div>
      {children}
    </div>
  );
}

function MiniFeature({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--landing-bg)] text-[var(--landing-text-subtle)]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-[var(--landing-text)]">{title}</span>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  body,
  accent,
  href,
  cta,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  body: string;
  accent: string;
  href: string;
  cta: string;
  features: readonly string[];
  highlighted?: boolean;
}) {
  return (
    <SurfacePanel
      className={`flex h-full flex-col p-6 ${highlighted ? 'border-white/15 bg-[color-mix(in_srgb,var(--landing-bg-card)_82%,white_4%)]' : ''}`}
    >
      <div
        className="inline-flex w-fit items-center rounded-sm px-3 py-1 text-[11px] uppercase tracking-[0.16em]"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, var(--landing-bg-surface))`, color: accent }}
      >
        {name}
      </div>
      <p className="landing-title mt-6 text-[40px] text-[var(--landing-text-dark)]">{price}</p>
      <p className="landing-body mt-3 text-[14px] text-[var(--landing-text-muted)]">{body}</p>

      <Link
        href={href}
        className={`mt-6 inline-flex h-11 items-center justify-center rounded-sm border px-4 text-sm transition-colors ${
          highlighted
            ? 'border-white bg-white font-medium text-black hover:border-[#dddddd] hover:bg-[#dddddd]'
            : 'border-[var(--landing-border-strong)] text-[var(--landing-text)] hover:bg-[var(--landing-bg-elevated)]'
        }`}
      >
        {cta}
      </Link>

      <ul className="mt-7 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[var(--landing-text)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-accent-green)]" />
            <span className="leading-6">{feature}</span>
          </li>
        ))}
      </ul>
    </SurfacePanel>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string; ext?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-[var(--landing-text-dark)]">{title}</h3>
      <div className="mt-4 flex flex-col gap-3">
        {links.map((link) =>
          link.ext ? (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text)]"
            >
              {link.label}
            </a>
          ) : (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text)]"
            >
              {link.label}
            </a>
          ),
        )}
      </div>
    </div>
  );
}
