import Link from 'next/link';
import { ArrowRight, Check, Github, Zap, Users, Keyboard, BarChart3, GitBranch, Layers, Shield, Globe, Clock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="landing-dark min-h-screen bg-[var(--landing-bg)] font-sans antialiased">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex h-[52px] items-center border-b border-[var(--landing-border)] bg-[var(--landing-bg)]">
        <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between px-5 lg:px-20">
          <Link href="/" className="flex items-center gap-2.5" aria-label="TaskNebula home">
            <div className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-white">
              <span className="text-[9px] font-bold tracking-tight text-[var(--landing-bg)]">TN</span>
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-[var(--landing-text)]">TaskNebula</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            <a href="#features" className="px-3 py-1.5 text-[13px] text-[var(--landing-text-subtle)] transition-colors hover:text-[var(--landing-text)]">Features</a>
            <a href="#open-source" className="px-3 py-1.5 text-[13px] text-[var(--landing-text-subtle)] transition-colors hover:text-[var(--landing-text)]">Open Source</a>
            <a href="#enterprise" className="px-3 py-1.5 text-[13px] text-[var(--landing-text-subtle)] transition-colors hover:text-[var(--landing-text)]">Enterprise</a>
            <a href="https://hub.docker.com/r/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-[13px] text-[var(--landing-text-subtle)] transition-colors hover:text-[var(--landing-text)]">Docker</a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth/signin" className="inline-flex h-[30px] items-center rounded-[5px] border border-[var(--landing-border)] px-[9px] text-[13px] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]">
              Sign in
            </Link>
            <Link href="/auth/signup" className="inline-flex h-[30px] items-center gap-[6px] rounded-[5px] border border-white bg-white px-[9px] text-[13px] text-black transition-colors hover:bg-[#e0e0e0]">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section id="hero" className="relative flex flex-col items-center overflow-hidden bg-[var(--landing-bg)] pt-[60px] pb-8 lg:pt-[100px]">
          <div className="relative z-10 flex flex-col items-center gap-4 px-5">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--landing-accent-blue)]/10 px-[9px] py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--landing-accent-blue)]">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Self-hosted &amp; Open Source
            </div>

            {/* Headline */}
            <h1 className="text-balance text-center text-[36px] font-semibold leading-[1] tracking-[-0.02em] text-white sm:text-[48px] lg:text-[72px]">
              Project Management
              <br />
              <span className="text-[var(--landing-text-muted)]">Teams Actually Love</span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-[560px] text-center text-[16px] leading-[1.5] tracking-[0.01em] text-[var(--landing-text-muted)] lg:text-[18px]">
              AI-powered automation, real-time collaboration, and Kanban boards.
              Self-host or deploy in minutes. Built for engineering teams.
            </p>

            {/* CTAs */}
            <div className="mt-2 flex items-center gap-2">
              <Link href="/auth/signup" className="inline-flex h-[32px] items-center gap-2 rounded-[5px] border border-white bg-white px-2.5 text-[14px] font-medium text-black transition-colors hover:bg-[#e0e0e0]">
                Start free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href="https://github.com/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="inline-flex h-[32px] items-center gap-2 rounded-[5px] border border-[var(--landing-border)] px-2.5 text-[14px] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]">
                <Github className="h-3.5 w-3.5" />
                GitHub
              </a>
            </div>

            {/* Docker pull */}
            <div className="mt-4 rounded-[5px] border border-[var(--landing-border)] bg-[var(--landing-bg-card)] px-3.5 py-2">
              <code className="font-mono text-[12px] text-[var(--landing-text-subtle)]">
                docker pull neuraparse/tasknebula
              </code>
            </div>
          </div>

          {/* Decorative dot grid */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </section>

        {/* Dot separator */}
        <DotSeparator />

        {/* Features Section */}
        <section id="features" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-5 pt-[60px] pb-16 lg:px-20 lg:pt-[100px]">
            <div className="flex flex-col items-start gap-4">
              <SectionBadge color="var(--landing-accent-blue)" label="Features" />
              <h2 className="max-w-[600px] text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-white lg:text-[40px]">
                Everything you need to ship faster
              </h2>
              <p className="max-w-[520px] text-[16px] leading-[1.5] tracking-[0.01em] text-[var(--landing-text-muted)]">
                Powerful features designed for modern teams. Focus on building, not managing.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-[var(--landing-border)] bg-[var(--landing-border)] sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
              <FeatureCard icon={<Zap className="h-4 w-4" />} color="var(--landing-accent-blue)" title="AI-Powered Automation" description="Auto-generate tasks, sprint plans, and summaries. Let AI handle the routine work." />
              <FeatureCard icon={<Users className="h-4 w-4" />} color="var(--landing-accent-green)" title="Real-Time Collaboration" description="Live presence indicators, instant updates, and conflict-free synchronization." />
              <FeatureCard icon={<Keyboard className="h-4 w-4" />} color="var(--landing-accent-violet)" title="Keyboard-First Design" description="Navigate at the speed of thought with the command palette. Every action is a keystroke away." />
              <FeatureCard icon={<Layers className="h-4 w-4" />} color="var(--landing-accent-amber)" title="Kanban & Sprint Views" description="Switch between boards, roadmaps, timelines, and workload views. Multiple perspectives." />
              <FeatureCard icon={<GitBranch className="h-4 w-4" />} color="var(--landing-accent-green)" title="GitHub Integration" description="Connect pull requests to issues. Track deployments and code changes in context." />
              <FeatureCard icon={<BarChart3 className="h-4 w-4" />} color="var(--landing-accent-blue)" title="Advanced Analytics" description="Burndown charts, velocity tracking, and capacity planning with real-time insights." />
            </div>
          </div>
        </section>

        {/* Dot separator */}
        <DotSeparator />

        {/* Open Source Section */}
        <section id="open-source" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-5 pt-[60px] pb-16 lg:px-20 lg:pt-[100px]">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
              <div className="flex flex-col items-start gap-4">
                <SectionBadge color="var(--landing-accent-green)" label="Open Source" />
                <h2 className="text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-white lg:text-[40px]">
                  Your data, your server,
                  <br />your rules
                </h2>
                <p className="text-[16px] leading-[1.6] tracking-[0.01em] text-[var(--landing-text-muted)] lg:text-[18px]">
                  TaskNebula is fully open source and self-hostable.
                  Deploy with Docker in minutes. No vendor lock-in, no telemetry.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <a href="https://github.com/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="inline-flex h-[32px] items-center gap-1.5 rounded-[5px] bg-white px-2.5 text-[14px] font-medium text-black transition-colors hover:bg-[#e0e0e0]">
                    View on GitHub
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <OpenSourceCard icon={<Globe className="h-4 w-4" />} title="Self-Hosted" description="Deploy on your own infrastructure. Docker Compose with PostgreSQL, Redis, and Next.js." />
                <OpenSourceCard icon={<Shield className="h-4 w-4" />} title="No Telemetry" description="Zero data collection. Your project data never leaves your server." />
                <OpenSourceCard icon={<Github className="h-4 w-4" />} title="MIT Licensed" description="Free to use, modify, and distribute. Fork it, customize it, make it yours." />
                <OpenSourceCard icon={<Clock className="h-4 w-4" />} title="Docker Ready" description="One command deploy with docker compose up. Auto-migration, seeding, and health checks." />
              </div>
            </div>
          </div>
        </section>

        {/* Dot separator */}
        <DotSeparator />

        {/* Enterprise Section */}
        <section id="enterprise" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-5 pt-[60px] pb-16 lg:px-20 lg:pt-[100px]">
            <div className="flex flex-col items-start gap-4">
              <SectionBadge color="var(--landing-accent-amber)" label="Enterprise" />
              <h2 className="max-w-[600px] text-balance text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-white lg:text-[40px]">
                Enterprise features for
                <br />secure, scalable teams
              </h2>
            </div>

            <div className="mt-10 overflow-hidden rounded-[12px] border border-[var(--landing-border)] bg-[var(--landing-bg-card)] lg:mt-14">
              {/* Enterprise features grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="border-b border-[var(--landing-border)] p-6 lg:border-b-0 lg:border-r lg:p-8">
                  <h3 className="text-[16px] font-medium text-white">Audit Trail</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--landing-text-muted)]">
                    63+ tracked actions with full actor attribution and timestamps.
                  </p>
                  <div className="mt-5 space-y-0">
                    <AuditRow color="var(--landing-accent-blue)" initials="SK" name="Sarah K." action="Updated sprint goal" time="just now" />
                    <AuditRow color="var(--landing-accent-amber)" initials="AL" name="Alex L." action="Created branch 'feat/api-v2'" time="2m ago" />
                    <AuditRow color="var(--landing-accent-green)" initials="MR" name="Maria R." action="Moved 3 issues to Done" time="5m ago" />
                    <AuditRow color="var(--landing-accent-violet)" initials="JD" name="Jake D." action="Added webhook integration" time="12m ago" />
                  </div>
                </div>
                <div className="p-6 lg:p-8">
                  <h3 className="text-[16px] font-medium text-white">Granular Permissions</h3>
                  <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--landing-text-muted)]">
                    30+ permission types with role-based access control.
                  </p>
                  <div className="mt-5 space-y-3">
                    <PermissionRow label="Project Management" enabled />
                    <PermissionRow label="Sprint Operations" enabled />
                    <PermissionRow label="Member Management" enabled={false} />
                    <PermissionRow label="Billing & Settings" enabled={false} />
                    <PermissionRow label="Workflow Editor" enabled />
                    <PermissionRow label="API Key Management" enabled={false} />
                  </div>
                </div>
              </div>

              {/* Marquee */}
              <div className="landing-marquee relative overflow-hidden border-t border-[var(--landing-border)]">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--landing-bg-card)] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--landing-bg-card)] to-transparent" />
                <div className="landing-marquee-track flex w-max">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex">
                      {['RBAC', 'OAuth 2.0', 'Audit Logs', 'Webhooks', 'API Keys', 'SSO', 'Custom Workflows', 'Data Export', 'Self-Hosting', 'Granular Permissions', 'GitHub Sync', 'Sprint Analytics'].map((tag) => (
                        <span key={`${i}-${tag}`} className="whitespace-nowrap border-r border-[var(--landing-border)] px-5 py-3 text-[12px] tracking-[0.02em] text-[var(--landing-text-muted)] transition-colors hover:bg-white/[0.03] hover:text-[var(--landing-text-subtle)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust row */}
              <div className="flex items-center justify-between border-t border-[var(--landing-border)] px-6 py-4 lg:px-8">
                <p className="text-[14px] text-[var(--landing-text-muted)]">Need enterprise features?</p>
                <Link href="/auth/signup" className="inline-flex h-[32px] items-center gap-1.5 rounded-[5px] bg-white px-2.5 text-[14px] font-medium text-black transition-colors hover:bg-[#e0e0e0]">
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Dot separator */}
        <DotSeparator />

        {/* Pricing Section */}
        <section id="pricing" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-5 pt-[60px] pb-16 lg:px-20 lg:pt-[100px]">
            <div className="flex flex-col items-start gap-4">
              <SectionBadge color="var(--landing-accent-violet)" label="Pricing" />
              <h2 className="text-[28px] font-semibold leading-[1] tracking-[-0.02em] text-white lg:text-[40px]">
                Simple pricing
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
              {/* Community */}
              <PricingCard
                name="Community"
                description="Self-hosted, unlimited users. Deploy on your own infrastructure."
                price="Free"
                color="var(--landing-accent-blue)"
                features={['Unlimited users & projects', 'Full Kanban & Sprint features', 'GitHub integration', 'Custom workflows', 'API access', 'Docker deployment']}
                cta="Deploy now"
                href="/auth/signup"
              />
              {/* Growth */}
              <PricingCard
                name="Growth"
                description="For teams that need advanced AI features and priority support."
                price="Coming Soon"
                color="var(--landing-accent-green)"
                features={['Everything in Community', 'AI task generation', 'AI sprint planning', 'Advanced analytics', 'Email notifications', 'Priority support']}
                cta="Join waitlist"
                href="/auth/signup"
                highlighted
              />
              {/* Enterprise */}
              <PricingCard
                name="Enterprise"
                description="Custom deployment, SLA, and dedicated support for large organizations."
                price="Custom"
                color="var(--landing-accent-amber)"
                features={['Everything in Growth', 'SSO / SAML', 'Dedicated support', 'Custom SLA', 'On-premise deployment', 'Compliance & audit']}
                cta="Contact us"
                href="/auth/signup"
              />
            </div>
          </div>
        </section>

        {/* Dot separator */}
        <DotSeparator />

        {/* Footer CTA */}
        <section className="bg-[var(--landing-bg)]">
          <div className="flex flex-col items-center px-5 pt-[80px] pb-[80px] lg:pt-[100px]">
            <h2 className="text-balance text-center text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[36px]">
              Ready to ship faster?
            </h2>
            <p className="mt-4 max-w-[440px] text-center text-[16px] leading-[1.5] text-[var(--landing-text-muted)]">
              Deploy TaskNebula in minutes. Self-hosted, open source, and free forever.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Link href="/auth/signup" className="inline-flex h-[32px] items-center gap-2 rounded-[5px] bg-white px-2.5 text-[14px] font-medium text-black transition-colors hover:bg-[#e0e0e0]">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href="https://hub.docker.com/r/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="inline-flex h-[32px] items-center rounded-[5px] border border-[var(--landing-border)] px-2.5 text-[14px] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]">
                Docker Hub
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)]">
        <div className="mx-auto max-w-screen-xl px-5 py-10 lg:px-20">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="flex items-center gap-2" aria-label="TaskNebula home">
                <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-white">
                  <span className="text-[9px] font-bold tracking-tight text-[var(--landing-bg)]">TN</span>
                </div>
                <span className="text-[13px] font-semibold tracking-tight text-[var(--landing-text)]">TaskNebula</span>
              </Link>
            </div>
            <FooterColumn title="Product" links={[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Enterprise', href: '#enterprise' },
              { label: 'Docker Hub', href: 'https://hub.docker.com/r/neuraparse/tasknebula', external: true },
            ]} />
            <FooterColumn title="Resources" links={[
              { label: 'Documentation', href: '#' },
              { label: 'GitHub', href: 'https://github.com/neuraparse/tasknebula', external: true },
              { label: 'Changelog', href: '#' },
              { label: 'API Reference', href: '#' },
            ]} />
            <FooterColumn title="Community" links={[
              { label: 'GitHub Discussions', href: '#' },
              { label: 'Contributing', href: '#' },
              { label: 'Report a Bug', href: '#' },
            ]} />
            <FooterColumn title="Legal" links={[
              { label: 'MIT License', href: '#' },
              { label: 'Privacy', href: '#' },
            ]} />
          </div>
          <div className="mt-10 border-t border-[var(--landing-border)] pt-6">
            <p className="text-[12px] text-[var(--landing-text-muted)]">
              &copy; {new Date().getFullYear()} TaskNebula. Open source under MIT License.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* --- Sub-components --- */

function DotSeparator() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden border-y border-[var(--landing-border)] bg-[var(--landing-bg)] p-1.5"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8px, 1fr))', gap: '6px', placeItems: 'center', height: '14px' }}
    >
      {Array.from({ length: 160 }).map((_, i) => (
        <div key={i} className="h-[1.5px] w-[1.5px] rounded-full bg-[var(--landing-border)]" />
      ))}
    </div>
  );
}

function SectionBadge({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-[11px] font-medium uppercase tracking-[0.04em]"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </div>
  );
}

function FeatureCard({ icon, color, title, description }: { icon: React.ReactNode; color: string; title: string; description: string }) {
  return (
    <div className="group bg-[var(--landing-bg-card)] p-6 transition-colors hover:bg-[var(--landing-bg-elevated)]">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-[6px]" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
        {icon}
      </div>
      <h3 className="mb-2 text-[15px] font-medium leading-tight tracking-[-0.01em] text-white">{title}</h3>
      <p className="text-[13px] leading-[1.6] tracking-[0.01em] text-[var(--landing-text-muted)]">{description}</p>
    </div>
  );
}

function OpenSourceCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-bg-card)] p-5 transition-colors hover:border-[var(--landing-text-muted)]/20">
      <div className="mb-2.5 flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--landing-accent-green)]/10 text-[var(--landing-accent-green)]">
        {icon}
      </div>
      <h3 className="mb-1.5 text-[14px] font-medium text-white">{title}</h3>
      <p className="text-[13px] leading-[1.5] text-[var(--landing-text-muted)]">{description}</p>
    </div>
  );
}

function AuditRow({ color, initials, name, action, time }: { color: string; initials: string; name: string; action: string; time: string }) {
  return (
    <div className="group flex items-center gap-3 border-b border-[var(--landing-border)] py-[10px] transition-colors last:border-b-0 hover:bg-white/[0.02]">
      <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
        <span className="text-[9px] font-medium" style={{ color }}>{initials}</span>
      </div>
      <span className="w-[52px] shrink-0 text-[11px] text-[var(--landing-text-muted)]">{time}</span>
      <span className="min-w-0 truncate text-[12px]">
        <span className="text-white/80">{name}</span>
        <span className="text-white/30"> &middot; </span>
        <span className="text-white/50">{action}</span>
      </span>
    </div>
  );
}

function PermissionRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={enabled
          ? { backgroundColor: 'var(--landing-accent-green)' }
          : { backgroundColor: 'transparent', border: '1.5px solid var(--landing-border)' }
        }
      />
      <span className={`text-[13px] ${enabled ? 'text-white/65' : 'text-white/25'}`}>{label}</span>
    </div>
  );
}

function PricingCard({ name, description, price, color, features, cta, href, highlighted }: {
  name: string; description: string; price: string; color: string; features: string[]; cta: string; href: string; highlighted?: boolean;
}) {
  return (
    <article className="flex flex-col">
      <div className="flex flex-1 flex-col gap-5 rounded-t-lg border border-b-0 border-[var(--landing-border-light)] bg-white p-5">
        <div>
          <h3 className="text-[22px] font-semibold leading-[1] tracking-[-0.02em] text-[#1a1a1a]">{name}</h3>
          <p className="mt-2 min-h-[40px] text-[13px] leading-[1.4] tracking-[0.01em] text-[#666]">{description}</p>
          <p className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">{price}</p>
          <div className="mt-4">
            <Link
              href={href}
              className={`flex h-[32px] w-full items-center justify-center rounded-[5px] border px-2.5 text-[14px] font-medium transition-colors ${
                highlighted
                  ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-[#333]'
                  : 'border-[#e5e5e5] text-[#1a1a1a] hover:bg-[#f5f5f5]'
              }`}
            >
              {cta}
            </Link>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#555]" />
              <span className="text-[13px] leading-[1.3] text-[#666]">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Colored bottom bar */}
      <div className="relative h-[6px]">
        <div className="absolute inset-0 rounded-b-sm opacity-50" style={{ backgroundColor: color }} />
        <div className="absolute inset-y-0 right-0 left-[15%] rounded-b-sm opacity-70" style={{ backgroundColor: color }} />
        <div className="absolute inset-y-0 right-0 left-[30%] rounded-b-sm" style={{ backgroundColor: color }} />
      </div>
    </article>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string; external?: boolean }[] }) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-medium text-[var(--landing-text)]">{title}</h3>
      <div className="flex flex-col gap-2">
        {links.map((link) =>
          link.external ? (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text)]">
              {link.label}
            </a>
          ) : (
            <a key={link.label} href={link.href} className="text-[13px] text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text)]">
              {link.label}
            </a>
          )
        )}
      </div>
    </div>
  );
}
