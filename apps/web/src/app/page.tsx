import Link from 'next/link';
import { ArrowRight, Check, Github, Zap, Users, Keyboard, BarChart3, GitBranch, Layers, Shield, Globe, Clock } from 'lucide-react';
import { ProductShowcase, TeamShowcase, WorkflowShowcase, SprintShowcase, AnalyticsShowcase } from '@/components/landing/product-showcase';

export default function HomePage() {
  return (
    <div className="landing-dark min-h-screen bg-[var(--landing-bg)] antialiased">
      {/* ─── Navigation ─── */}
      <nav className="sticky top-0 z-50 flex h-[52px] items-center border-b border-[var(--landing-border)] bg-[var(--landing-bg)]">
        <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between px-5 lg:px-20">
          <Link href="/" className="flex items-center gap-2.5" aria-label="TaskNebula home">
            <div className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-white">
              <span className="text-[9px] font-bold tracking-tight text-[#0c0c0c]">TN</span>
            </div>
            <span className="text-[14px] font-medium tracking-tight text-[var(--landing-text)]">TaskNebula</span>
          </Link>

          <div className="hidden items-center gap-0.5 lg:flex">
            {['Features', 'Open Source', 'Security', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="px-3.5 py-1.5 text-[13px] font-[420] text-[var(--landing-text-body)] transition-colors duration-200 hover:text-[var(--landing-text)]">
                {item}
              </a>
            ))}
            <a href="https://hub.docker.com/r/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 text-[13px] font-[420] text-[var(--landing-text-body)] transition-colors duration-200 hover:text-[var(--landing-text)]">
              Docker
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth/signin" className="inline-flex h-[30px] items-center rounded-[5px] border border-[var(--landing-border-strong)] px-[9px] text-[13px] font-[420] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]">
              Sign in
            </Link>
            <Link href="/auth/signup" className="inline-flex h-[30px] items-center gap-[7px] rounded-[5px] border border-white bg-white px-2.5 text-[13px] font-[420] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content">
        {/* ─── Hero ─── */}
        <section id="hero" className="relative flex flex-col items-center overflow-hidden bg-[var(--landing-bg)] pt-[60px] pb-3 lg:pt-[100px]">
          <div className="relative z-10 flex flex-col items-center gap-3 px-4">
            <SectionBadge color="var(--landing-accent-blue)" label="Self-hosted & Open Source" />

            <h1 className="text-balance text-center text-[36px] font-[500] leading-[100%] tracking-[-0.02em] text-white sm:text-[48px] lg:text-[72px]">
              Project Management
            </h1>
            <p className="text-center text-[36px] font-[500] leading-[100%] tracking-[-0.02em] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] sm:text-[48px] lg:text-[72px]">
              Teams Actually Love
            </p>

            <p className="mt-1 max-w-[520px] text-center text-base font-[420] leading-[125%] tracking-[0.02em] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] lg:text-lg">
              AI-powered automation, real-time collaboration, and Kanban boards.
              Self-host with Docker in minutes.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Link href="/auth/signup" className="group/cta inline-flex h-[32px] items-center gap-2 rounded-[5px] border border-white bg-white px-2.5 text-[14px] font-[420] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]">
                Start free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href="https://github.com/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="inline-flex h-[32px] items-center gap-2 rounded-[5px] border border-[var(--landing-border-strong)] px-2.5 text-[14px] font-[420] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]">
                <Github className="h-3.5 w-3.5" />
                GitHub
              </a>
            </div>

            <div className="mt-5 rounded-[5px] border border-[var(--landing-border)] bg-[var(--landing-bg-card)] px-3.5 py-2">
              <code className="font-mono text-[12px] text-[var(--landing-text-subtle)]">
                docker pull neuraparse/tasknebula
              </code>
            </div>
          </div>

          {/* Decorative dot background */}
          <div className="dot-bg pointer-events-none absolute inset-0" />
        </section>

        {/* ─── Product Showcase ─── */}
        <ProductShowcase />

        <DotSeparator />

        {/* ─── Features ─── */}
        <section id="features" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-4 pt-[60px] pb-10 sm:px-8 lg:px-20 lg:pt-[100px]">
            <div className="flex flex-col items-start gap-3 sm:gap-4">
              <SectionBadge color="var(--landing-accent-blue)" label="Features" />
              <h2 className="max-w-[600px] text-balance text-[32px] font-[500] leading-[100%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[36px] lg:text-[40px]">
                Everything you need to ship faster
              </h2>
              <p className="max-w-[480px] font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] text-base leading-[150%] tracking-[0.02em]">
                Powerful features designed for modern teams. Focus on building, not managing.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-[12px] border border-[var(--landing-border)] bg-[var(--landing-border)] sm:mt-10 lg:mt-12">
              <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard icon={<Zap className="h-4 w-4" />} color="var(--landing-accent-blue)" title="AI-Powered Automation" description="Auto-generate tasks, sprint plans, and summaries. Let AI handle the routine work." />
                <FeatureCard icon={<Users className="h-4 w-4" />} color="var(--landing-accent-green)" title="Real-Time Collaboration" description="Live presence indicators, instant updates, and conflict-free synchronization." />
                <FeatureCard icon={<Keyboard className="h-4 w-4" />} color="var(--landing-accent-violet)" title="Keyboard-First Design" description="Navigate at the speed of thought with the command palette. Every action is a keystroke away." />
                <FeatureCard icon={<Layers className="h-4 w-4" />} color="var(--landing-accent-amber)" title="Kanban & Sprint Views" description="Switch between boards, roadmaps, timelines, and workload views." />
                <FeatureCard icon={<GitBranch className="h-4 w-4" />} color="var(--landing-accent-green)" title="GitHub Integration" description="Connect pull requests to issues. Track deployments and code changes in context." />
                <FeatureCard icon={<BarChart3 className="h-4 w-4" />} color="var(--landing-accent-pink)" title="Advanced Analytics" description="Burndown charts, velocity tracking, and capacity planning with real-time insights." />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Feature Showcases ─── */}
        <section className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-4 pt-10 pb-10 sm:px-8 lg:px-20 space-y-16">
            {/* Team & Collaboration */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-12 items-center">
              <div>
                <SectionBadge color="var(--landing-accent-green)" label="Collaboration" />
                <h3 className="mt-3 text-[24px] font-[500] leading-[110%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[28px]">
                  Your entire team,<br />in real-time
                </h3>
                <p className="mt-3 font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] text-[15px] leading-[150%] tracking-[0.02em]">
                  See who&apos;s online, what they&apos;re working on, and collaborate without stepping on each other&apos;s toes.
                </p>
              </div>
              <TeamShowcase />
            </div>

            {/* Workflows */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12 items-center">
              <WorkflowShowcase />
              <div>
                <SectionBadge color="var(--landing-accent-violet)" label="Workflows" />
                <h3 className="mt-3 text-[24px] font-[500] leading-[110%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[28px]">
                  Custom workflows<br />that match your process
                </h3>
                <p className="mt-3 font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] text-[15px] leading-[150%] tracking-[0.02em]">
                  Define statuses, transitions, and automation rules. Auto-move issues when conditions are met.
                </p>
              </div>
            </div>

            {/* Sprints + Analytics side by side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-4">
                  <SectionBadge color="var(--landing-accent-amber)" label="Sprints" />
                  <h3 className="mt-3 text-[24px] font-[500] leading-[110%] tracking-[-0.02em] text-[var(--landing-text-dark)]">
                    Sprint planning,<br />visualized
                  </h3>
                </div>
                <SprintShowcase />
              </div>
              <div>
                <div className="mb-4">
                  <SectionBadge color="var(--landing-accent-pink)" label="Analytics" />
                  <h3 className="mt-3 text-[24px] font-[500] leading-[110%] tracking-[-0.02em] text-[var(--landing-text-dark)]">
                    Data-driven<br />decisions
                  </h3>
                </div>
                <AnalyticsShowcase />
              </div>
            </div>
          </div>
        </section>

        <DotSeparator />

        {/* ─── Open Source ─── */}
        <section id="open-source" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-4 pt-[60px] pb-10 sm:px-8 lg:px-20 lg:pt-[100px]">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-[60px]">
              <div className="flex flex-col items-start gap-3 sm:gap-4">
                <SectionBadge color="var(--landing-accent-green)" label="Open Source" />
                <h2 className="text-balance text-[32px] font-[500] leading-[100%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[36px] lg:text-[40px]">
                  Your data, your server,
                  <br />your rules
                </h2>
                <p className="font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] text-base leading-[150%] tracking-[0.02em] lg:text-lg">
                  Fully open source and self-hostable.
                  Deploy with Docker in minutes. No vendor lock-in, no telemetry.
                </p>
                <a href="https://github.com/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="group/cta mt-1 inline-flex h-[32px] items-center gap-1.5 rounded-[5px] border border-white bg-white px-2.5 text-[14px] font-[420] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]">
                  View on GitHub
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard icon={<Globe className="h-4 w-4" />} color="var(--landing-accent-green)" title="Self-Hosted" description="Deploy on your own infrastructure. Docker Compose with PostgreSQL, Redis, and Next.js." />
                <InfoCard icon={<Shield className="h-4 w-4" />} color="var(--landing-accent-green)" title="No Telemetry" description="Zero data collection. Your project data never leaves your server." />
                <InfoCard icon={<Github className="h-4 w-4" />} color="var(--landing-accent-green)" title="MIT Licensed" description="Free to use, modify, and distribute. Fork it, customize it, make it yours." />
                <InfoCard icon={<Clock className="h-4 w-4" />} color="var(--landing-accent-green)" title="Docker Ready" description="One command deploy. Auto-migration, seeding, and health checks built in." />
              </div>
            </div>
          </div>
        </section>

        <DotSeparator />

        {/* ─── Security & Control ─── */}
        <section id="security" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-4 pt-[60px] pb-10 sm:px-8 lg:px-20 lg:pt-[100px]">
            <div className="flex flex-col items-start gap-3 sm:gap-4">
              <SectionBadge color="var(--landing-accent-amber)" label="Security" />
              <h2 className="max-w-[600px] text-balance text-[32px] font-[500] leading-[100%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[36px] lg:text-[40px]">
                Built-in security for
                <br />teams of any size
              </h2>
            </div>

            <div className="mt-8 overflow-hidden rounded-[12px] bg-[var(--landing-bg-card)] sm:mt-10 lg:mt-12">
              {/* Audit + Permissions grid */}
              <div className="grid grid-cols-1 border-b border-[var(--landing-border)] lg:grid-cols-[1fr_420px]">
                <div className="border-[var(--landing-border)] lg:border-r">
                  <div className="px-6 pt-6 md:px-8 md:pt-8">
                    <h3 className="text-[16px] font-[500] leading-[120%] tracking-[-0.01em] text-white">Audit Trail</h3>
                    <p className="mt-2 max-w-[480px] font-[420] text-[#F6F6F6]/50 text-[14px] leading-[150%] tracking-[0.02em]">
                      63+ tracked actions with full actor attribution.
                    </p>
                  </div>
                  <div className="mt-5 px-6 md:px-8">
                    <AuditRow color="var(--landing-accent-blue)" initials="S" name="Sarah K." action='Completed sprint "v2.1 Release"' time="just now" opacity={0.75} />
                    <AuditRow color="var(--landing-accent-amber)" initials="D" name="Danny S." action='Moved TN-142 to In Review' time="2m ago" opacity={0.5} />
                    <AuditRow color="var(--landing-accent-green)" initials="A" name="Abhay K." action='Created issue "Fix auth redirect"' time="5m ago" opacity={0.35} />
                    <AuditRow color="var(--landing-accent-violet)" initials="S" name="Sid G." action='Changed role of alex@team.io to Admin' time="12m ago" opacity={0.22} />
                    <AuditRow color="var(--landing-accent-blue)" initials="S" name="Sarah K." action='Assigned TN-89 to Danny S.' time="32s ago" opacity={0.12} />
                    <AuditRow color="var(--landing-accent-pink)" initials="T" name="Theo L." action='Added custom workflow "Bug Triage"' time="1m ago" opacity={0.05} />
                  </div>
                  <div className="h-6 md:h-8" />
                </div>
                <div className="border-t border-[var(--landing-border)] lg:border-t-0">
                  <div className="px-6 pt-6 md:px-8 md:pt-8">
                    <h3 className="text-[16px] font-[500] leading-[120%] tracking-[-0.01em] text-white">Access Control</h3>
                    <p className="mt-1.5 font-[420] text-[#F6F6F6]/50 text-[14px] leading-[150%] tracking-[0.02em]">
                      30+ permission types with role-based access.
                    </p>
                  </div>
                  <div className="mt-5 space-y-2.5 px-6 pb-6 md:px-8 md:pb-8">
                    <PermLabel label="Issues" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <PermDot enabled label="Create Issues" color="var(--landing-accent-blue)" />
                      <PermDot enabled label="Assign Issues" color="var(--landing-accent-blue)" />
                      <PermDot enabled label="Transition Issues" color="var(--landing-accent-blue)" />
                      <PermDot enabled={false} label="Delete Issues" />
                    </div>
                    <PermLabel label="Sprint Management" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <PermDot enabled label="Manage Sprints" color="var(--landing-accent-amber)" />
                      <PermDot enabled label="Start Sprint" color="var(--landing-accent-amber)" />
                      <PermDot enabled={false} label="Delete Sprint" />
                      <PermDot enabled label="Complete Sprint" color="var(--landing-accent-amber)" />
                    </div>
                    <PermLabel label="Members & Workflows" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <PermDot enabled label="Invite Members" color="var(--landing-accent-green)" />
                      <PermDot enabled={false} label="Remove Members" />
                      <PermDot enabled label="Manage Workflows" color="var(--landing-accent-green)" />
                      <PermDot enabled label="Change Roles" color="var(--landing-accent-green)" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-1 border-b border-[var(--landing-border)] sm:grid-cols-3">
                <TrustBadge title="Open Source" subtitle="MIT License" color="var(--landing-accent-amber)" />
                <TrustBadge title="Self-Hosted" subtitle="Docker & Kubernetes" color="var(--landing-accent-blue)" />
                <TrustBadge title="Audit Logs" subtitle="63+ action types tracked" color="var(--landing-accent-green)" />
              </div>

              {/* Marquee */}
              <Marquee tags={['RBAC', 'Audit Logs', 'Custom Workflows', 'Self-Hosting', '35+ Permissions', 'Sprint Management', 'Kanban Boards', 'Issue Tracking', 'Team Roles', 'Docker Deploy', 'Real-Time Updates', 'MIT Licensed']} />

              {/* CTA row */}
              <div className="flex items-center justify-between border-t border-[var(--landing-border)] px-6 py-5 md:px-8 md:py-6">
                <p className="font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_40%,transparent)] text-base leading-[150%] tracking-[0.02em]">All included, free and open source</p>
                <Link href="/auth/signup" className="group/cta inline-flex h-[32px] items-center gap-1.5 rounded-[5px] border border-white bg-white px-2.5 text-[14px] font-[420] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]">
                  Get started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <DotSeparator />

        {/* ─── Pricing ─── */}
        <section id="pricing" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-screen-xl px-4 pt-[60px] pb-10 sm:px-8 lg:px-20 lg:pt-[100px]">
            <div className="flex flex-col items-start gap-3 sm:gap-4">
              <SectionBadge color="var(--landing-accent-pink)" label="Pricing" />
              <h2 className="text-[32px] font-[500] leading-[100%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[36px] lg:text-[40px]">
                Pricing
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:mt-10 lg:mt-12 lg:grid-cols-3">
              <PricingCard name="Community" description="Self-hosted, unlimited users" price="Free" color="var(--landing-accent-blue)" features={['Unlimited users & projects', 'Full Kanban & Sprint features', 'GitHub integration', 'Custom workflows', 'API access', 'Docker deployment']} cta="Deploy now" href="/auth/signup" />
              <PricingCard name="Growth" description="Advanced AI features and priority support" price="Coming Soon" color="var(--landing-accent-green)" features={['Everything in Community', 'AI task generation', 'AI sprint planning', 'Advanced analytics', 'Email notifications', 'Priority support']} cta="Join waitlist" href="/auth/signup" highlighted />
              <PricingCard name="Enterprise" description="Custom deployment, SLA, and dedicated support" price="Custom" color="var(--landing-accent-amber)" features={['Everything in Growth', 'SSO / SAML', 'Dedicated support', 'Custom SLA', 'On-premise deployment', 'Compliance & audit']} cta="Contact us" href="/auth/signup" />
            </div>
          </div>
        </section>

        <DotSeparator />

        {/* ─── Footer CTA ─── */}
        <section className="bg-[var(--landing-bg)]">
          <div className="flex flex-col items-center px-4 pt-[80px] pb-[80px] sm:px-8 lg:pt-[100px]">
            <h2 className="text-balance text-center text-[28px] font-[500] leading-[100%] tracking-[-0.02em] text-[var(--landing-text-dark)] sm:text-[32px] lg:text-[36px]">
              Ready to ship faster?
            </h2>
            <p className="mt-4 max-w-[400px] text-center font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] text-base leading-[150%] tracking-[0.02em]">
              Deploy TaskNebula in minutes. Self-hosted, open source, and free forever.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Link href="/auth/signup" className="inline-flex h-[32px] items-center gap-2 rounded-[5px] border border-white bg-white px-2.5 text-[14px] font-[420] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a href="https://hub.docker.com/r/neuraparse/tasknebula" target="_blank" rel="noopener noreferrer" className="inline-flex h-[32px] items-center rounded-[5px] border border-[var(--landing-border-strong)] px-2.5 text-[14px] font-[420] text-[var(--landing-text)] transition-colors hover:bg-[var(--landing-bg-elevated)]">
                Docker Hub
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer role="contentinfo" className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] pb-10 text-sm">
        <div className="mx-auto max-w-screen-xl px-4 pt-10 sm:px-8 lg:px-20">
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" aria-label="TaskNebula home" className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-white">
                  <span className="text-[9px] font-bold tracking-tight text-[#0c0c0c]">TN</span>
                </div>
              </Link>
            </div>
            <FooterCol title="Product" links={[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Security', href: '#security' },
              { label: 'Docker Hub', href: 'https://hub.docker.com/r/neuraparse/tasknebula', ext: true },
            ]} />
            <FooterCol title="Resources" links={[
              { label: 'GitHub', href: 'https://github.com/neuraparse/tasknebula', ext: true },
              { label: 'Documentation', href: '#' },
              { label: 'Changelog', href: '#' },
              { label: 'API Reference', href: '#' },
            ]} />
            <FooterCol title="Community" links={[
              { label: 'Discussions', href: '#' },
              { label: 'Contributing', href: '#' },
              { label: 'Report a Bug', href: '#' },
            ]} />
            <FooterCol title="Legal" links={[
              { label: 'MIT License', href: '#' },
              { label: 'Privacy', href: '#' },
            ]} />
          </nav>
          <div className="mt-10 border-t border-[var(--landing-border)] pt-6">
            <p className="text-[12px] font-[420] text-[var(--landing-text-muted)]">
              &copy; {new Date().getFullYear()} TaskNebula. Open source under MIT License.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────── Sub-components ─────────────────── */

function DotSeparator() {
  return (
    <div aria-hidden="true" className="dot-grid-separator overflow-hidden border-y border-[var(--landing-border)] bg-[var(--landing-bg)] p-1.5" style={{ height: 14 }}>
      {Array.from({ length: 200 }).map((_, i) => (
        <div key={i} className="h-[1.5px] w-[1.5px] rounded-full bg-[var(--landing-border)]" />
      ))}
    </div>
  );
}

function SectionBadge({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md px-[9px] py-0.5 text-[11px] font-medium uppercase tracking-[0.04em]" style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
      <div className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </div>
  );
}

function FeatureCard({ icon, color, title, description }: { icon: React.ReactNode; color: string; title: string; description: string }) {
  return (
    <div className="group bg-[var(--landing-bg-card)] p-6 transition-colors duration-150 hover:bg-[var(--landing-bg-hover)] md:p-8">
      <div className="mb-3 flex h-[24px] w-[24px] items-center justify-center rounded-[6px]" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
        {icon}
      </div>
      <h3 className="mb-2 text-[16px] font-[500] leading-[120%] tracking-[-0.01em] text-white">{title}</h3>
      <p className="font-[420] text-[14px] leading-[150%] tracking-[0.02em] text-[#F6F6F6]/50">{description}</p>
    </div>
  );
}

function InfoCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-bg-card)] p-5 transition-colors duration-150 hover:border-[var(--landing-border-strong)] hover:bg-[var(--landing-bg-surface)]">
      <div className="mb-2.5 flex h-[24px] w-[24px] items-center justify-center rounded-[6px]" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
        {icon}
      </div>
      <h3 className="mb-1.5 text-[14px] font-[500] text-white">{title}</h3>
      <p className="font-[420] text-[13px] leading-[150%] text-[#F6F6F6]/50">{description}</p>
    </div>
  );
}

function AuditRow({ color, initials, name, action, time, opacity }: { color: string; initials: string; name: string; action: string; time: string; opacity: number }) {
  return (
    <div className="group relative overflow-hidden border-b border-[var(--landing-border)] bg-[var(--landing-bg-card)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--landing-bg-hover)]">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] transition-opacity duration-150 group-hover:opacity-100" style={{ backgroundColor: color, opacity }} />
      <div className="flex min-w-0 items-center gap-3 py-[10px] pl-5 pr-4">
        <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          <span className="text-[9px] font-medium leading-none" style={{ color }}>{initials}</span>
        </div>
        <span className="w-[56px] shrink-0 font-[420] text-[#F6F6F6]/30 text-[11px] leading-none tracking-[0.02em]">{time}</span>
        <span className="min-w-0 truncate text-[12px] leading-none tracking-[0.02em]">
          <span className="text-[#F6F6F6]/80">{name}</span>
          <span className="hidden sm:inline">
            <span className="text-[#F6F6F6]/40"> &middot; </span>
            <span className="text-[#F6F6F6]/55">{action}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function PermLabel({ label }: { label: string }) {
  return <span className="mt-1 block font-[420] text-[#F6F6F6]/30 text-[10px] uppercase leading-none tracking-[0.08em]">{label}</span>;
}

function PermDot({ label, enabled, color }: { label: string; enabled: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="h-[6px] w-[6px] shrink-0 rounded-full" style={enabled && color ? { backgroundColor: color } : { backgroundColor: 'transparent', border: '1.5px solid #3a3a3a' }} />
      <span className={`truncate font-[420] text-[11px] leading-none tracking-[0.02em] ${enabled ? 'text-[#F6F6F6]/65' : 'text-[#F6F6F6]/25'}`}>{label}</span>
    </div>
  );
}

function TrustBadge({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--landing-border)] px-4 py-3.5 transition-colors hover:bg-[var(--landing-bg-hover)] sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}>
        <div className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: color, opacity: 0.75 }} />
      </div>
      <div className="flex flex-col gap-[3px]">
        <strong className="font-[500] text-[13px] leading-none text-white">{title}</strong>
        <span className="font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_30%,transparent)] text-xs leading-none tracking-[0.02em]">{subtitle}</span>
      </div>
    </div>
  );
}

function Marquee({ tags }: { tags: string[] }) {
  return (
    <div className="landing-marquee relative overflow-hidden border-t border-[var(--landing-border)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24" style={{ background: 'linear-gradient(to right, var(--landing-bg-card), transparent)' }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24" style={{ background: 'linear-gradient(to left, var(--landing-bg-card), transparent)' }} />
      <div className="landing-marquee-track flex w-max">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex">
            {tags.map((tag) => (
              <span key={`${i}-${tag}`} className="whitespace-nowrap border-r border-[var(--landing-border)] px-5 py-4 font-[420] text-[color-mix(in_srgb,var(--landing-text-subtle)_40%,transparent)] text-[13px] leading-none tracking-[0.02em] transition-colors hover:bg-white/[0.04] hover:text-[color-mix(in_srgb,var(--landing-text-subtle)_55%,transparent)]">
                {tag}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingCard({ name, description, price, color, features, cta, href, highlighted }: {
  name: string; description: string; price: string; color: string; features: string[]; cta: string; href: string; highlighted?: boolean;
}) {
  return (
    <article className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 rounded-t-lg border border-b-0 border-[var(--landing-border-light)] bg-white p-5">
        <div className="flex flex-col">
          <h3 className="text-[24px] font-[500] leading-[100%] tracking-[-0.02em] text-[#1a1a1a]">{name}</h3>
          <p className="mt-2 min-h-[44px] font-[420] text-[#5c5c5c] text-sm leading-[125%] tracking-[0.02em]">{description}</p>
          <p className="mt-4 flex items-center gap-1.5 text-[20px] font-[500] leading-[100%] tracking-[-0.02em] text-[#1a1a1a]">{price}</p>
          <div className="mt-4">
            <Link href={href} className={`flex h-[32px] w-full items-center justify-center rounded-[5px] border px-2.5 text-[14px] font-[420] transition-colors ${highlighted ? 'border-[#1D1D1D] bg-[#1D1D1D] text-white hover:border-[#333] hover:bg-[#333]' : 'border-[var(--landing-border-light)] text-[#1a1a1a] hover:bg-[#f5f5f5]'}`}>
              {cta}
            </Link>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-[#404040]" />
              <span className="font-[400] text-[#5c5c5c] text-sm leading-[125%] tracking-[0.02em]">{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative h-[6px]">
        <div className="absolute inset-0 rounded-b-sm opacity-60" style={{ backgroundColor: color }} />
        <div className="absolute inset-y-0 right-0 left-[12%] rounded-b-sm opacity-60" style={{ backgroundColor: color }} />
        <div className="absolute inset-y-0 right-0 left-[25%] rounded-b-sm" style={{ backgroundColor: color }} />
      </div>
    </article>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string; ext?: boolean }[] }) {
  return (
    <div>
      <h3 className="mb-4 font-medium text-[var(--landing-text)] text-sm">{title}</h3>
      <div className="flex flex-col gap-2.5">
        {links.map((l) => l.ext ? (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm font-[420] text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text)]">{l.label}</a>
        ) : (
          <a key={l.label} href={l.href} className="text-sm font-[420] text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text)]">{l.label}</a>
        ))}
      </div>
    </div>
  );
}
