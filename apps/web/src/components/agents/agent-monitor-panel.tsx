'use client';

import { Button } from '@/components/ui/button';
import {
  Bot,
  Lock,
  Sparkles,
  GitBranch,
  Code2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentMonitorPanelProps {
  issueId?: string;
  className?: string;
}

export function AgentMonitorPanel({ issueId, className }: AgentMonitorPanelProps) {
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">Agent Executions</h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
            Enterprise
          </span>
        </div>
      </div>

      {/* Locked Content */}
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
            <Lock className="h-7 w-7 text-amber-500" />
          </div>
          <p className="font-semibold text-foreground mb-2">AI Agent Monitor</p>
          <p className="text-sm text-muted-foreground max-w-[320px] mb-6">
            Monitor AI agents as they write code, create branches, and submit pull requests automatically.
          </p>

          {/* Feature List */}
          <div className="w-full max-w-[300px] text-left bg-muted/30 rounded-lg p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Enterprise features:</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5">
                <Code2 className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Real-time code generation</span>
              </li>
              <li className="flex items-center gap-2.5">
                <GitBranch className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Automated branch & PR creation</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Live execution logs</span>
              </li>
            </ul>
          </div>

          <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Sparkles className="h-4 w-4" />
            Upgrade to Enterprise
          </Button>
        </div>
      </div>
    </div>
  );
}
