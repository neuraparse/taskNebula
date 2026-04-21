import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Github,
  Shield,
  Sparkles,
  Users,
  Workflow,
  Check,
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

type AccentTone = 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose';

const capabilities: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  tag: string;
  tone: AccentTone;
}> = [
  {
    icon: Workflow,
    title: 'Run delivery in one place',
    body: 'Backlog, board, sprint, and roadmap stay in the same surface.',
    tag: 'Delivery',
    tone: 'violet',
  },
  {
    icon: BookOpen,
    title: 'Write next to the work',
    body: 'Docs, notes, revisions, and linked issues live inside the workspace.',
    tag: 'Docs',
    tone: 'emerald',
  },
  {
    icon: Shield,
    title: 'Keep control close',
    body: 'Settings, permissions, API keys, webhooks, and audit stay readable.',
    tag: 'Control',
    tone: 'cyan',
  },
];

const pricingPlans = [
  {
    name: 'Community',
    price: 'Free',
    body: 'Full self-hosted core.',
    tone: 'blue' as AccentTone,
    href: '/auth/signup',
    cta: 'Create workspace',
    features: ['Projects, docs, sprints', 'Workflows and permissions', 'GitHub, API keys, webhooks'],
  },
  {
    name: 'Growth',
    price: 'Soon',
    body: 'More automation and reporting.',
    tone: 'emerald' as AccentTone,
    href: '/auth/signup',
    cta: 'Join waitlist',
    highlighted: true,
    features: ['Everything in Community', 'Expanded AI assistance', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    body: 'Rollout and governance support.',
    tone: 'amber' as AccentTone,
    href: '/auth/signup',
    cta: 'Talk to us',
    features: ['Everything in Growth', 'Custom deployment path', 'Dedicated success support'],
  },
] as const;

export default function HomePage() {
  return (
    <div className="landing-dark min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--landing-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--landing-text-dark)] focus:outline-2 focus:outline-offset-2 focus:outline-[hsl(var(--accent-blue))]"
      >
        Skip to content
      </a>

      <nav
        aria-label="Marketing"
        className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-bg)_92%,transparent)] backdrop-blur-md"
      >
        <Shell className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="TaskNebula home">
            <TaskNebulaLogo className="shrink-0" />
            <span className="landing-title text-[15px] text-[var(--landing-text-dark)]">TaskNebula</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-[13px] text-[var(--landing-text-muted)] transition-colors duration-150 hover:text-[var(--landing-text-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--accent-blue))]"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="hidden h-[34px] items-center rounded-md border border-[var(--landing-border-strong)] px-3 text-[13px] font-[430] text-[var(--landing-text)] transition-all duration-150 ease-snap hover:bg-[var(--landing-bg-elevated)] sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-[34px] items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-[430] text-primary-foreground transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:shadow-glow-primary hover:opacity-95"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Shell>
      </nav>

      <main id="main-content">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[var(--landing-border)]">
          <div
            className="bg-aurora animate-aurora pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
          <Shell className="relative py-24 sm:py-28">
            <div className="animate-blur-in max-w-4xl">
              <Kicker label="Open source · docs-native · self-hosted" accentVar="var(--landing-accent-blue)" />
              <h1 className="landing-display mt-7 max-w-4xl text-balance text-[48px] text-[var(--landing-text-dark)] sm:text-[66px] lg:text-[86px]">
                Project operations,{' '}
                <span className="text-gradient-primary">without the sprawl.</span>
              </h1>
              <p className="landing-body mt-6 max-w-2xl text-[16px] text-[var(--landing-text-subtle)] sm:text-[18px]">
                Boards, docs, workflows, analytics, and admin control in one stable workspace.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/auth/signup"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-[430] text-primary-foreground transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:shadow-glow-primary hover:opacity-95"
                >
                  Start with Community
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/neuraparse/tasknebula"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--landing-border-strong)] px-4 text-sm font-[430] text-[var(--landing-text)] transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:bg-[var(--landing-bg-elevated)]"
                >
                  <Github className="h-4 w-4" />
                  View source
                </a>
              </div>

              <div className="stagger mt-10 flex flex-wrap items-center gap-2">
                <span className="live-pill">Live demo below</span>
                {heroSignals.map((signal) => (
                  <span key={signal} className="chip-cyan">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </Shell>
        </section>

        <HeroShowcase />

        <section id="product" className="border-t border-[var(--landing-border)]">
          <Shell className="py-20 sm:py-24">
            <SectionHeader
              kicker="Product"
              kickerAccentVar="var(--landing-accent-emerald)"
              title="Built to stay clear as the workspace grows."
              description="Less noise, tighter surfaces, and one product language across execution, docs, and control."
            />

            <div className="stagger mt-10 grid gap-4 xl:grid-cols-3">
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
          <Shell className="py-20 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <SectionHeader
                  kicker="Security"
                  kickerAccentVar="var(--landing-accent-blue)"
                  title="Control surfaces stay inside the product."
                  description="Permissions, API keys, webhooks, audit, and admin settings keep the same calm language."
                  compact
                />
                <ul className="stagger mt-8 space-y-3">
                  {['MIT licensed', 'Docker-first', 'Your infra, your data'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[var(--landing-text)]">
                      <span className="status-dot status-live" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="stagger grid gap-3 sm:grid-cols-2">
                <MiniFeature icon={Shield} title="Role-based access" tone="blue" />
                <MiniFeature icon={Sparkles} title="Automation and rules" tone="violet" />
                <MiniFeature icon={Users} title="Admin and team controls" tone="emerald" />
              </div>
            </div>
          </Shell>
        </section>

        <section id="pricing" className="border-t border-[var(--landing-border)]">
          <Shell className="py-20 sm:py-24">
            <SectionHeader
              kicker="Pricing"
              kickerAccentVar="var(--landing-accent-violet)"
              title="Strong free core. Extra layers only when needed."
              description="The open-source base is the product, not a teaser."
            />

            <div className="stagger mt-10 grid gap-4 xl:grid-cols-3">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.name} {...plan} />
              ))}
            </div>
          </Shell>
        </section>

        <section className="relative overflow-hidden border-t border-[var(--landing-border)]">
          <div
            className="bg-aurora animate-aurora pointer-events-none absolute inset-0 opacity-70"
            aria-hidden="true"
          />
          <Shell className="relative py-20 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <Kicker
                label="Ready to launch"
                accentVar="var(--landing-accent-emerald)"
                center
              />
              <h2 className="landing-display mt-6 text-balance text-[36px] text-[var(--landing-text-dark)] sm:text-[48px] lg:text-[60px]">
                Ship from one{' '}
                <span className="text-gradient-primary">calmer workspace.</span>
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/auth/signup"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-[430] text-primary-foreground transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:shadow-glow-primary hover:opacity-95"
                >
                  Create workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/neuraparse/tasknebula"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--landing-border-strong)] px-4 text-sm font-[430] text-[var(--landing-text)] transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:bg-[var(--landing-bg-elevated)]"
                >
                  <Github className="h-4 w-4" />
                  Explore repo
                </a>
              </div>
            </div>
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
                  <p className="text-[11px] text-[var(--landing-text-muted)]">
                    Self-hosted project operating system
                  </p>
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

function Kicker({
  label,
  accentVar,
  center = false,
}: {
  label: string;
  accentVar: string;
  center?: boolean;
}) {
  return (
    <span
      className={`landing-kicker inline-flex items-center gap-2 text-[var(--landing-text-muted)] ${
        center ? 'justify-center' : ''
      }`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: accentVar }}
      />
      {label}
    </span>
  );
}

function SectionHeader({
  kicker,
  kickerAccentVar,
  title,
  description,
  compact = false,
}: {
  kicker: string;
  kickerAccentVar: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'max-w-2xl' : 'max-w-3xl'}>
      <Kicker label={kicker} accentVar={kickerAccentVar} />
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
  tag,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tag: string;
  tone: AccentTone;
}) {
  return (
    <SurfacePanel className="h-full p-6 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-md">
      <div className={`icon-tile icon-tile-accent-${tone} h-11 w-11`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="landing-title mt-6 text-[22px] text-[var(--landing-text-dark)]">{title}</h3>
      <p className="landing-body mt-3 text-[14px] text-[var(--landing-text-muted)]">{body}</p>
      <span className={`chip-${tone} mt-5 inline-flex`}>{tag}</span>
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
    <div
      className={`grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center ${
        reverse ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''
      }`}
    >
      <div className="max-w-xl">
        <Kicker label={eyebrow} accentVar="var(--landing-accent-cyan)" />
        <h3 className="landing-title mt-4 text-balance text-[30px] text-[var(--landing-text-dark)] sm:text-[38px]">
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
        <h3 className="landing-title text-[26px] text-[var(--landing-text-dark)]">{title}</h3>
        <p className="landing-body mt-2 text-[14px] text-[var(--landing-text-muted)]">{body}</p>
      </div>
      {children}
    </div>
  );
}

function MiniFeature({
  icon: Icon,
  title,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  tone: AccentTone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-4 py-3 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-sm">
      <div className={`icon-tile icon-tile-accent-${tone} h-9 w-9`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm text-[var(--landing-text)]">{title}</span>
    </div>
  );
}

function PricingCard({
  name,
  price,
  body,
  tone,
  href,
  cta,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  body: string;
  tone: AccentTone;
  href: string;
  cta: string;
  features: readonly string[];
  highlighted?: boolean;
}) {
  return (
    <SurfacePanel
      className={`flex h-full flex-col p-6 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-md ${
        highlighted ? 'border-primary/25' : ''
      }`}
    >
      <span className={`chip-${tone} self-start`}>{name}</span>
      <p className="landing-title mt-5 text-[38px] text-[var(--landing-text-dark)]">{price}</p>
      <p className="landing-body mt-2 text-[14px] text-[var(--landing-text-muted)]">{body}</p>

      <Link
        href={href}
        className={`mt-6 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-[430] transition-all duration-150 ease-snap hover:-translate-y-0.5 ${
          highlighted
            ? 'bg-primary text-primary-foreground hover:shadow-glow-primary hover:opacity-95'
            : 'border border-[var(--landing-border-strong)] text-[var(--landing-text)] hover:bg-[var(--landing-bg-elevated)]'
        }`}
      >
        {cta}
      </Link>

      <ul className="mt-7 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[var(--landing-text)]">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: 'hsl(var(--accent-emerald))' }}
            />
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
              className="text-sm text-[var(--landing-text-muted)] transition-colors duration-150 hover:text-[var(--landing-text)]"
            >
              {link.label}
            </a>
          ) : (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[var(--landing-text-muted)] transition-colors duration-150 hover:text-[var(--landing-text)]"
            >
              {link.label}
            </a>
          ),
        )}
      </div>
    </div>
  );
}
