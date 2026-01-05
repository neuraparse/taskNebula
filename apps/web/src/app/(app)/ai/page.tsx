import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Calendar, TrendingUp, Lightbulb, Zap } from 'lucide-react';
import Link from 'next/link';

export default function AIAssistantPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Leverage AI to streamline your project management workflow
        </p>
      </div>

      {/* AI Features Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AIFeatureCard
          icon={<FileText className="h-8 w-8" />}
          title="Generate Issue from Description"
          description="Describe your feature or bug in plain text, and let AI create a properly structured ticket with title, description, and metadata."
          href="/ai/generate-issue"
          badge="Popular"
        />

        <AIFeatureCard
          icon={<Sparkles className="h-8 w-8" />}
          title="Summarize Thread"
          description="Get a concise summary of long comment threads, highlighting key decisions and action items."
          href="#"
          badge="Coming Soon"
          disabled
        />

        <AIFeatureCard
          icon={<Calendar className="h-8 w-8" />}
          title="Sprint Planning Assistant"
          description="AI-powered sprint planning based on team capacity, velocity, and backlog priorities."
          href="#"
          badge="Coming Soon"
          disabled
        />

        <AIFeatureCard
          icon={<TrendingUp className="h-8 w-8" />}
          title="Project Health Analysis"
          description="Analyze project metrics and get insights on risks, velocity trends, and recommendations."
          href="#"
          badge="Coming Soon"
          disabled
        />

        <AIFeatureCard
          icon={<Lightbulb className="h-8 w-8" />}
          title="Improve Issue Title"
          description="Make your issue titles clearer, more actionable, and professional with AI suggestions."
          href="#"
          badge="Coming Soon"
          disabled
        />

        <AIFeatureCard
          icon={<Zap className="h-8 w-8" />}
          title="Estimate Story Points"
          description="Get AI-powered story point estimates based on issue complexity and historical data."
          href="#"
          badge="Coming Soon"
          disabled
        />
      </div>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>AI Usage This Month</CardTitle>
          <CardDescription>Your team&apos;s AI assistant activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Issues Generated</p>
              <p className="text-2xl font-bold">24</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Threads Summarized</p>
              <p className="text-2xl font-bold">12</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sprints Planned</p>
              <p className="text-2xl font-bold">3</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AIFeatureCard({
  icon,
  title,
  description,
  href,
  badge,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  badge?: string;
  disabled?: boolean;
}) {
  const content = (
    <Card className={disabled ? 'opacity-60' : 'hover:shadow-md transition-shadow cursor-pointer'}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">{icon}</div>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        <CardTitle className="mt-4">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant={disabled ? 'outline' : 'default'} className="w-full" disabled={disabled}>
          {disabled ? 'Coming Soon' : 'Try Now'}
        </Button>
      </CardContent>
    </Card>
  );

  if (disabled) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

