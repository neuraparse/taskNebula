'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Loader2, Send, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InitiativeDetail {
  initiative: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    targetDate: string | null;
    color: string | null;
    workspaceId: string;
  };
  projects: Array<{
    projectId: string;
    projectName: string | null;
    projectKey: string | null;
    projectStatus: string | null;
  }>;
  children: Array<{ id: string; name: string; status: string }>;
}

interface InitiativeUpdate {
  id: string;
  status: string;
  summary: string;
  blockers: string | null;
  nextSteps: string | null;
  weekOf: string;
  createdAt: string;
  authorName: string | null;
  authorImage: string | null;
}

interface RollUpResponse {
  done: number;
  total: number;
  percent: number;
  projectCount: number;
  perProject: Array<{
    projectId: string;
    projectName: string | null;
    projectKey: string | null;
    done: number;
    total: number;
    percent: number;
  }>;
}

export function InitiativeDetailClient({ initiativeId }: { initiativeId: string }) {
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery<InitiativeDetail>({
    queryKey: ['initiative', initiativeId],
    queryFn: async () => {
      const res = await fetch(`/api/initiatives/${initiativeId}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const { data: rollup } = useQuery<RollUpResponse>({
    queryKey: ['initiative-rollup', initiativeId],
    queryFn: async () => {
      const res = await fetch(`/api/initiatives/${initiativeId}/roll-up`);
      if (!res.ok) throw new Error('Failed to load roll-up');
      return res.json();
    },
  });

  const { data: updates } = useQuery<{ updates: InitiativeUpdate[] }>({
    queryKey: ['initiative-updates', initiativeId],
    queryFn: async () => {
      const res = await fetch(`/api/initiatives/${initiativeId}/updates`);
      if (!res.ok) throw new Error('Failed to load updates');
      return res.json();
    },
  });

  // Post-update form state
  const [status, setStatus] = useState<'green' | 'yellow' | 'red'>('green');
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  const postUpdate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/initiatives/${initiativeId}/updates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, summary, blockers, nextSteps }),
      });
      if (!res.ok) throw new Error('Failed to post update');
      return res.json();
    },
    onSuccess: () => {
      setSummary('');
      setBlockers('');
      setNextSteps('');
      queryClient.invalidateQueries({ queryKey: ['initiative-updates', initiativeId] });
    },
  });

  if (isLoading || !detail) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading initiative...
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex h-full flex-col overflow-auto">
      <div className="border-border bg-background border-b px-6 py-5">
        <Link
          href="/initiatives"
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 text-xs"
        >
          <ChevronLeft className="h-3 w-3" />
          All initiatives
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="kicker">Initiative</span>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Target className="text-muted-foreground h-5 w-5" />
              {detail.initiative.name}
            </h1>
            {detail.initiative.description ? (
              <p className="text-muted-foreground text-sm">{detail.initiative.description}</p>
            ) : null}
          </div>
          <Badge variant="outline" className="uppercase tracking-wider">
            {detail.initiative.status}
          </Badge>
        </div>
      </div>

      <div className="grid flex-1 gap-6 px-6 py-6 lg:grid-cols-3">
        {/* Roll-up + member projects */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Roll-up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Progress value={rollup?.percent ?? 0} className="h-3 flex-1" />
                <div className="w-16 text-right font-mono text-sm tabular-nums">
                  {rollup?.percent ?? 0}%
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                {rollup
                  ? `${rollup.done}/${rollup.total} issues complete across ${rollup.projectCount} project${rollup.projectCount === 1 ? '' : 's'}`
                  : 'No data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Member projects</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {detail.projects.length === 0 ? (
                <div className="text-muted-foreground px-6 py-8 text-center text-sm">
                  No projects linked yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-border bg-surface border-b">
                    <tr className="text-muted-foreground text-left text-[10px] uppercase tracking-wider">
                      <th className="px-4 py-2">Key</th>
                      <th className="px-4 py-2">Project</th>
                      <th className="px-4 py-2">Issues</th>
                      <th className="px-4 py-2 text-right">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.projects.map((p) => {
                      const stats = rollup?.perProject.find((r) => r.projectId === p.projectId);
                      return (
                        <tr key={p.projectId} className="border-border border-b last:border-b-0">
                          <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                            {p.projectKey ?? '—'}
                          </td>
                          <td className="px-4 py-2">{p.projectName ?? p.projectId}</td>
                          <td className="text-muted-foreground px-4 py-2 text-xs">
                            {stats ? `${stats.done}/${stats.total}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                            {stats ? `${stats.percent}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {detail.children.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sub-initiatives</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul>
                  {detail.children.map((child) => (
                    <li
                      key={child.id}
                      className="border-border flex items-center justify-between border-b px-4 py-2 last:border-b-0"
                    >
                      <Link
                        href={`/initiatives/${child.id}`}
                        className="text-foreground hover:text-primary text-sm"
                      >
                        {child.name}
                      </Link>
                      <Badge variant="outline" className="uppercase tracking-wider">
                        {child.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Updates feed + post-update form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post update</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="kicker text-[10px]">Status</label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as 'green' | 'yellow' | 'red')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Green — on track</SelectItem>
                    <SelectItem value="yellow">Yellow — at risk</SelectItem>
                    <SelectItem value="red">Red — blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="kicker text-[10px]">Summary</label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="What happened this week?"
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="kicker text-[10px]">Blockers</label>
                <Input
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Anything in the way?"
                />
              </div>
              <div className="space-y-1">
                <label className="kicker text-[10px]">Next steps</label>
                <Input
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  placeholder="What's up next?"
                />
              </div>
              <Button
                onClick={() => postUpdate.mutate()}
                disabled={!summary || postUpdate.isPending}
                className="w-full"
              >
                {postUpdate.isPending ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3 w-3" />
                )}
                Post update
              </Button>
              {postUpdate.error ? (
                <p className="text-destructive text-xs">{(postUpdate.error as Error).message}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {!updates?.updates || updates.updates.length === 0 ? (
                <p className="text-muted-foreground text-sm">No updates yet.</p>
              ) : (
                updates.updates.map((u) => (
                  <div key={u.id} className="border-border bg-surface rounded-md border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-foreground text-xs font-medium">
                        {u.authorName ?? 'Anonymous'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="uppercase tracking-wider">
                          {u.status}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">{u.weekOf}</span>
                      </div>
                    </div>
                    <p className="text-sm">{u.summary}</p>
                    {u.blockers ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        <span className="font-medium">Blockers:</span> {u.blockers}
                      </p>
                    ) : null}
                    {u.nextSteps ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        <span className="font-medium">Next:</span> {u.nextSteps}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
