import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Calendar, TrendingUp, Lightbulb, Zap, Lock } from 'lucide-react';

export default function AIAssistantPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
            Enterprise
          </span>
        </div>
        <p className="text-muted-foreground">
          Leverage AI to streamline your project management workflow
        </p>
      </div>

      {/* Upgrade Banner */}
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Upgrade to Enterprise</p>
            <p className="text-sm text-muted-foreground">
              Unlock all AI features including autonomous agents, smart planning, and more.
            </p>
          </div>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2 shrink-0">
            <Sparkles className="h-4 w-4" />
            Upgrade Now
          </Button>
        </CardContent>
      </Card>

      {/* AI Features Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AIFeatureCard
          icon={<FileText className="h-8 w-8" />}
          title="Generate Issue from Description"
          description="Describe your feature or bug in plain text, and let AI create a properly structured ticket."
        />

        <AIFeatureCard
          icon={<Sparkles className="h-8 w-8" />}
          title="Summarize Thread"
          description="Get a concise summary of long comment threads, highlighting key decisions."
        />

        <AIFeatureCard
          icon={<Calendar className="h-8 w-8" />}
          title="Sprint Planning Assistant"
          description="AI-powered sprint planning based on team capacity and velocity."
        />

        <AIFeatureCard
          icon={<TrendingUp className="h-8 w-8" />}
          title="Project Health Analysis"
          description="Analyze project metrics and get insights on risks and recommendations."
        />

        <AIFeatureCard
          icon={<Lightbulb className="h-8 w-8" />}
          title="Improve Issue Title"
          description="Make your issue titles clearer and more actionable with AI suggestions."
        />

        <AIFeatureCard
          icon={<Zap className="h-8 w-8" />}
          title="Estimate Story Points"
          description="Get AI-powered story point estimates based on issue complexity."
        />
      </div>

      {/* Usage Stats - Locked */}
      <Card className="opacity-60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>AI Usage This Month</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardDescription>Upgrade to view your team&apos;s AI usage analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Issues Generated</p>
              <p className="text-2xl font-bold text-muted-foreground">--</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Threads Summarized</p>
              <p className="text-2xl font-bold text-muted-foreground">--</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sprints Planned</p>
              <p className="text-2xl font-bold text-muted-foreground">--</p>
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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="opacity-70 cursor-not-allowed">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-muted p-3 text-muted-foreground">{icon}</div>
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="mt-4 text-muted-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" disabled>
          <Lock className="h-4 w-4 mr-2" />
          Requires Enterprise
        </Button>
      </CardContent>
    </Card>
  );
}
