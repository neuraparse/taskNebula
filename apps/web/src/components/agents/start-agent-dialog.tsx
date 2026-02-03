'use client';

import { useState } from 'react';
import { useStartAgentExecution } from '@/lib/hooks/use-agent-execution';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Loader2, Sparkles, Lock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface StartAgentDialogProps {
  issueId: string;
  children?: React.ReactNode;
}

interface AgentProfile {
  executor: string;
  variant: string;
  displayName: string;
  description: string;
  available: boolean;
}

export function StartAgentDialog({ issueId, children }: StartAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [initialPrompt, setInitialPrompt] = useState('');

  const { mutate: startExecution, isPending } = useStartAgentExecution();

  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['agent-profiles'],
    queryFn: async () => {
      const response = await fetch('/api/agents/profiles');
      if (!response.ok) throw new Error('Failed to fetch profiles');
      return response.json();
    },
  });

  const profiles = profilesData?.profiles || [];
  const availableProfiles = profiles.filter((p: AgentProfile) => p.available);

  const selectedProfileData = profiles.find(
    (p: AgentProfile) => p.executor === selectedProfile && p.variant === selectedVariant
  );

  const handleStart = () => {
    if (!selectedProfile || !selectedVariant) return;

    startExecution(
      {
        issueId,
        executorProfile: selectedProfile,
        executorVariant: selectedVariant,
        initialPrompt: initialPrompt || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setSelectedProfile('');
          setSelectedVariant('');
          setInitialPrompt('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Bot className="h-4 w-4" />
            <span>Start AI Agent</span>
            <span className="text-[9px] px-1 py-0 rounded font-semibold border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
              Enterprise
            </span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            AI Agent
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
              Enterprise
            </span>
          </DialogTitle>
          <DialogDescription>
            AI agents can autonomously write code, create branches, and submit pull requests.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Locked Feature UI */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              AI Agent execution is available on Enterprise plans. Upgrade to unlock autonomous code generation, automated PRs, and more.
            </p>

            {/* Feature List */}
            <div className="text-left bg-muted/30 rounded-lg p-4 mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What you get:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Autonomous code generation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Automated branch & PR creation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Claude & GPT-4 agent support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Real-time execution logs</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Sparkles className="h-4 w-4" />
            Upgrade to Enterprise
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} className="w-full">
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
