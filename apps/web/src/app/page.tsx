import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
              <span className="text-xs font-semibold tracking-tight text-background">TN</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">TaskNebula</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm" className="h-8 text-[13px] font-medium">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" className="h-8 gap-1 text-[13px] font-medium">
                Get started
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="container mx-auto max-w-screen-xl px-6 py-20 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-[980px] text-center">
              {/* Badge */}
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium tracking-tight">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground"></span>
                </span>
                Built for high-performing teams
              </div>

              {/* Headline */}
              <h1 className="mb-6 text-[44px] font-semibold leading-[1.1] tracking-tight sm:text-[56px] lg:text-[72px]">
                The project management
                <br />
                tool teams love to use
              </h1>

              {/* Subheadline */}
              <p className="mx-auto mb-10 max-w-[680px] text-[17px] leading-[1.6] text-muted-foreground sm:text-[19px]">
                Streamline your workflow with AI-powered automation, real-time collaboration,
                and intelligent insights. Built for engineering teams who ship fast.
              </p>

              {/* CTA */}
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/auth/signup">
                  <Button size="lg" className="h-11 gap-1.5 px-6 text-[15px] font-medium">
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button size="lg" variant="outline" className="h-11 px-6 text-[15px] font-medium">
                    View demo
                  </Button>
                </Link>
              </div>

              {/* Trust Badge */}
              <p className="mt-8 text-xs text-muted-foreground">
                Trusted by engineering teams worldwide
              </p>
            </div>
          </div>

          {/* Gradient Background */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-muted/20 to-transparent"></div>
        </section>

        {/* Features Grid */}
        <section className="border-t">
          <div className="container mx-auto max-w-screen-xl px-6 py-24 lg:px-8 lg:py-32">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-[32px] font-semibold leading-[1.2] tracking-tight sm:text-[40px]">
                Everything you need to ship faster
              </h2>
              <p className="mx-auto max-w-[640px] text-[17px] leading-[1.6] text-muted-foreground">
                Powerful features designed for modern teams. Focus on building, not managing.
              </p>
            </div>

            <div className="grid gap-px border-b border-l">
              <div className="grid gap-px md:grid-cols-3">
                <FeatureCard
                  title="AI-Powered Automation"
                  description="Automatically generate tasks, sprint plans, and intelligent summaries. Let AI handle the routine work so you can focus on what matters."
                />
                <FeatureCard
                  title="Real-Time Collaboration"
                  description="See changes instantly across your team. Live presence indicators, conflict-free updates, and seamless synchronization."
                />
                <FeatureCard
                  title="Keyboard-First Design"
                  description="Navigate at the speed of thought with ⌘K command palette. Every action is just a few keystrokes away."
                />
              </div>
              <div className="grid gap-px md:grid-cols-3">
                <FeatureCard
                  title="Flexible Views"
                  description="Switch between Kanban boards, roadmaps, timelines, and workload views. Multiple perspectives on the same data."
                />
                <FeatureCard
                  title="GitHub Integration"
                  description="Connect pull requests to issues automatically. Track deployments and monitor code changes in context."
                />
                <FeatureCard
                  title="Advanced Analytics"
                  description="Burndown charts, velocity tracking, and capacity planning. Make data-driven decisions with real-time insights."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="border-t bg-muted/20">
          <div className="container mx-auto max-w-screen-xl px-6 py-24 lg:px-8 lg:py-32">
            <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
              <div>
                <h2 className="mb-6 text-[32px] font-semibold leading-[1.2] tracking-tight">
                  Built for teams that move fast
                </h2>
                <p className="mb-8 text-[17px] leading-[1.7] text-muted-foreground">
                  TaskNebula is designed from the ground up for high-velocity engineering teams.
                  Optimize your workflow, reduce friction, and ship with confidence.
                </p>
                <ul className="space-y-4">
                  <BenefitItem text="Lightning-fast interface with instant search" />
                  <BenefitItem text="Automatic status updates and smart notifications" />
                  <BenefitItem text="Customizable workflows that adapt to your process" />
                  <BenefitItem text="Enterprise-grade security and compliance" />
                </ul>
              </div>
              <div>
                <h2 className="mb-6 text-[32px] font-semibold leading-[1.2] tracking-tight">
                  Insights that drive decisions
                </h2>
                <p className="mb-8 text-[17px] leading-[1.7] text-muted-foreground">
                  Get a clear view of your team's progress with real-time analytics and
                  intelligent forecasting. Understand bottlenecks before they become problems.
                </p>
                <ul className="space-y-4">
                  <BenefitItem text="Real-time burndown and velocity metrics" />
                  <BenefitItem text="Predictive sprint planning with AI" />
                  <BenefitItem text="Team workload balancing and capacity insights" />
                  <BenefitItem text="Custom reports and data exports" />
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t">
          <div className="container mx-auto max-w-screen-xl px-6 py-24 lg:px-8 lg:py-32">
            <div className="mx-auto max-w-[720px] text-center">
              <h2 className="mb-5 text-[40px] font-semibold leading-[1.1] tracking-tight sm:text-[48px]">
                Start shipping faster today
              </h2>
              <p className="mb-10 text-[17px] leading-[1.6] text-muted-foreground">
                Join thousands of teams who trust TaskNebula to manage their projects.
                Free 14-day trial, no credit card required.
              </p>
              <Link href="/auth/signup">
                <Button size="lg" className="h-12 gap-2 px-8 text-[15px] font-medium">
                  Get started for free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto max-w-screen-xl px-6 py-12 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground">
                <span className="text-[10px] font-semibold tracking-tight text-background">TN</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">TaskNebula</span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              &copy; 2025 TaskNebula. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="group border-r border-t bg-background p-8 transition-colors hover:bg-muted/30">
      <h3 className="mb-3 text-[17px] font-semibold leading-tight tracking-tight">{title}</h3>
      <p className="text-[15px] leading-[1.7] text-muted-foreground">{description}</p>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <Check className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
      <span className="text-[15px] leading-[1.7] text-muted-foreground">{text}</span>
    </li>
  );
}
