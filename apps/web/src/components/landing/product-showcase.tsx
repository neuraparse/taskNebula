'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, CheckSquare, Bug, Zap, MessageSquare, CheckCircle2, ArrowUp, Minus, ArrowDown, Users, Shield, GitBranch, Play, BarChart3, Search, Bell, Settings, ChevronRight, ArrowRight, Clock } from 'lucide-react';

/* ─── Shared ─── */
const typeIcon: Record<string, { icon: typeof BookOpen; color: string }> = {
  story: { icon: BookOpen, color: '#10b981' },
  task: { icon: CheckSquare, color: '#3b82f6' },
  bug: { icon: Bug, color: '#ef4444' },
  epic: { icon: Zap, color: '#8b5cf6' },
};
const priorityColor: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#94a3b8' };
const c = (color: string, opacity: number) => `color-mix(in srgb, ${color} ${opacity}%, transparent)`;

/* ════════════════════════════════════════════════════════
   1. HERO SHOWCASE — Interactive Kanban Board
   ════════════════════════════════════════════════════════ */
const boardCards = [
  { col: 0, key: 'TN-18', title: 'Add dark mode toggle', type: 'task' as const, priority: 'low' as const },
  { col: 0, key: 'TN-22', title: 'API docs for v2 endpoints', type: 'task' as const, priority: 'medium' as const },
  { col: 1, key: 'TN-12', title: 'OAuth2 with GitHub provider', type: 'story' as const, priority: 'high' as const, assignee: 'SK' },
  { col: 1, key: 'TN-15', title: 'Fix pagination on project list', type: 'bug' as const, priority: 'critical' as const, assignee: 'DW', comments: 3 },
  { col: 1, key: 'TN-19', title: 'Design sprint retro template', type: 'task' as const, priority: 'medium' as const },
  { col: 2, key: 'TN-08', title: 'Real-time presence indicators', type: 'story' as const, priority: 'high' as const, assignee: 'AK', comments: 5, subtasks: '2/4' },
  { col: 2, key: 'TN-11', title: 'Kanban DnD optimization', type: 'task' as const, priority: 'medium' as const, assignee: 'TL' },
  { col: 3, key: 'TN-05', title: 'Email notification templates', type: 'story' as const, priority: 'high' as const, assignee: 'SK', comments: 8, subtasks: '3/3' },
  { col: 4, key: 'TN-01', title: 'CI/CD with GitHub Actions', type: 'epic' as const, priority: 'high' as const, assignee: 'DW' },
  { col: 4, key: 'TN-03', title: 'Database migration framework', type: 'task' as const, priority: 'medium' as const, assignee: 'AK' },
];
const columns = [
  { name: 'Backlog', accent: '#64748b' },
  { name: 'To Do', accent: '#6b7280' },
  { name: 'In Progress', accent: '#3b82f6' },
  { name: 'In Review', accent: '#8b5cf6' },
  { name: 'Done', accent: '#10b981' },
];

export function HeroShowcase() {
  const [cards, setCards] = useState(boardCards);
  const [moving, setMoving] = useState<string | null>(null);

  // Periodically move a card to next column
  useEffect(() => {
    const interval = setInterval(() => {
      setCards(prev => {
        const movable = prev.filter(c => c.col < 4);
        if (movable.length === 0) return prev;
        const pick = movable[Math.floor(Math.random() * movable.length)];
        setMoving(pick.key);
        setTimeout(() => setMoving(null), 800);
        return prev.map(c => c.key === pick.key ? { ...c, col: c.col + 1 } : c);
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="bg-[var(--landing-bg)] pb-4">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-8 lg:px-20">
        <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-bg-card)]">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-[var(--landing-border)] px-4 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="rounded bg-[var(--landing-bg)] border border-[var(--landing-border)] px-3 py-0.5 text-[10px] text-[var(--landing-text-muted)] font-mono">
                tasknebula.io / Sprint 4 — Board
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="flex gap-2.5 p-3 overflow-x-auto min-h-[380px]">
            {columns.map((col, ci) => {
              const colCards = cards.filter(c => c.col === ci);
              return (
                <div key={col.name} className="flex-shrink-0 w-[200px] rounded-lg bg-white/[0.015] border border-[var(--landing-border)]" style={{ borderTopColor: col.accent, borderTopWidth: 2 }}>
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <span className="text-[10px] font-[500] uppercase tracking-wider text-[var(--landing-text-body)]">{col.name}</span>
                    <span className="rounded-full px-1.5 text-[9px] font-bold tabular-nums bg-white/5 text-[var(--landing-text-muted)]">{colCards.length}</span>
                  </div>
                  <div className="px-1.5 pb-1.5 space-y-1.5">
                    {colCards.map(card => (
                      <MiniCard key={card.key} card={card} isMoving={moving === card.key} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Presence bar */}
          <div className="flex items-center justify-between border-t border-[var(--landing-border)] px-4 py-1.5">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {['SK', 'AK', 'DW'].map(i => (
                  <div key={i} className="h-5 w-5 rounded-full bg-white/10 border-2 border-[var(--landing-bg-card)] flex items-center justify-center text-[7px] font-bold text-[var(--landing-text-body)]">{i}</div>
                ))}
              </div>
              <span className="text-[9px] text-[var(--landing-text-muted)] ml-1">3 viewing</span>
            </div>
            <span className="text-[9px] text-[var(--landing-text-muted)]">Auto-saved</span>
          </div>

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12" style={{ background: 'linear-gradient(to top, var(--landing-bg-card), transparent)' }} />
        </div>
      </div>
    </section>
  );
}

function MiniCard({ card, isMoving }: { card: typeof boardCards[0]; isMoving: boolean }) {
  const ti = typeIcon[card.type];
  const Icon = ti.icon;
  return (
    <div className={`relative rounded border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-2 overflow-hidden transition-all duration-500 ${isMoving ? 'scale-[1.04] shadow-lg shadow-blue-500/10 border-blue-500/30 -translate-y-0.5' : 'hover:border-[var(--landing-border-strong)]'}`}>
      <div className="absolute top-0 left-0 w-[2px] h-full" style={{ backgroundColor: priorityColor[card.priority] }} />
      <div className="flex items-center justify-between mb-1 pl-1">
        <div className="flex items-center gap-1">
          <Icon className="h-2.5 w-2.5" style={{ color: ti.color }} />
          <span className="text-[9px] font-mono text-[var(--landing-text-muted)]">{card.key}</span>
        </div>
        {card.assignee && (
          <div className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center text-[7px] font-bold text-[var(--landing-text-body)]">{card.assignee}</div>
        )}
      </div>
      <p className="text-[10px] font-[420] leading-[1.35] text-[var(--landing-text)] pl-1 line-clamp-2">{card.title}</p>
      {(card.comments || card.subtasks) && (
        <div className="flex items-center gap-2 mt-1.5 pt-1 border-t border-[var(--landing-border)] pl-1">
          {card.subtasks && <span className="flex items-center gap-0.5 text-[8px] text-[var(--landing-text-muted)]"><CheckCircle2 className="h-2 w-2" />{card.subtasks}</span>}
          {card.comments && <span className="flex items-center gap-0.5 text-[8px] text-[var(--landing-text-muted)]"><MessageSquare className="h-2 w-2" />{card.comments}</span>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   2. FEATURE SHOWCASES — Inline with feature sections
   ════════════════════════════════════════════════════════ */

/* ─── Team & Collaboration ─── */
const teamMembers = [
  { name: 'Sarah Kim', role: 'Product Owner', initials: 'SK', color: '#2ABBF8', status: 'online', activity: 'Reviewing TN-05' },
  { name: 'Abhay Kumar', role: 'Tech Lead', initials: 'AK', color: '#33c482', status: 'online', activity: 'Working on TN-08' },
  { name: 'Danny Wong', role: 'Developer', initials: 'DW', color: '#FFCC02', status: 'online', activity: 'In code review' },
  { name: 'Theo Lee', role: 'Developer', initials: 'TL', color: '#701FFC', status: 'away', activity: 'Idle for 15m' },
  { name: 'Maria Chen', role: 'Designer', initials: 'MC', color: '#FA4EDF', status: 'offline', activity: 'Last seen 2h ago' },
  { name: 'Sam Carter', role: 'QA Engineer', initials: 'SC', color: '#f97316', status: 'online', activity: 'Testing sprint 3' },
];

export function TeamShowcase() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setPulse(p => (p + 1) % teamMembers.length), 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <ShowcaseFrame title="Team" url="tasknebula.io / Team Overview">
      <div className="grid grid-cols-[220px_1fr] h-[340px]">
        {/* Members list */}
        <div className="border-r border-[var(--landing-border)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--landing-border)]">
            <span className="text-[10px] font-[500] uppercase tracking-wider text-[var(--landing-text-muted)]">Members ({teamMembers.length})</span>
          </div>
          {teamMembers.map((m, i) => (
            <div key={m.initials} className={`flex items-center gap-2.5 px-3 py-2 border-b border-[var(--landing-border)] transition-colors duration-300 ${pulse === i ? 'bg-white/[0.03]' : ''}`}>
              <div className="relative">
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: c(m.color, 12), color: m.color }}>{m.initials}</div>
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--landing-bg-card)] ${m.status === 'online' ? 'bg-emerald-500' : m.status === 'away' ? 'bg-amber-500' : 'bg-gray-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-[500] text-[var(--landing-text)] truncate">{m.name}</p>
                <p className="text-[9px] text-[var(--landing-text-muted)] truncate">{m.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <div className="p-3">
          <span className="text-[10px] font-[500] uppercase tracking-wider text-[var(--landing-text-muted)]">Live Activity</span>
          <div className="mt-3 space-y-2.5">
            {[
              { who: 'SK', action: 'moved TN-05 to In Review', time: 'just now', color: '#2ABBF8' },
              { who: 'AK', action: 'commented on TN-08', time: '2m ago', color: '#33c482' },
              { who: 'DW', action: 'completed TN-03', time: '5m ago', color: '#FFCC02' },
              { who: 'SC', action: 'created bug TN-15', time: '12m ago', color: '#f97316' },
              { who: 'SK', action: 'started Sprint 4', time: '1h ago', color: '#2ABBF8' },
              { who: 'TL', action: 'pushed 3 commits to feat/dnd', time: '2h ago', color: '#701FFC' },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 animate-fade-in" style={{ animationDelay: `${i * 100}ms`, opacity: 1 - i * 0.12 }}>
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0" style={{ backgroundColor: c(a.color, 12), color: a.color }}>{a.who}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[var(--landing-text)]"><span className="font-[500]">{a.who}</span> <span className="text-[#F6F6F6]/50">{a.action}</span></p>
                  <p className="text-[9px] text-[var(--landing-text-muted)]">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

/* ─── Workflow Showcase ─── */
const workflowSteps = [
  { name: 'Backlog', color: '#64748b', count: 12 },
  { name: 'To Do', color: '#6b7280', count: 8 },
  { name: 'In Progress', color: '#3b82f6', count: 5 },
  { name: 'In Review', color: '#8b5cf6', count: 3 },
  { name: 'QA Testing', color: '#f97316', count: 2 },
  { name: 'Done', color: '#10b981', count: 24 },
];

export function WorkflowShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setActiveStep(s => (s + 1) % workflowSteps.length), 1800);
    return () => clearInterval(i);
  }, []);

  return (
    <ShowcaseFrame title="Workflows" url="tasknebula.io / Project Settings / Workflow">
      <div className="p-5 h-[320px]">
        {/* Flow visualization */}
        <div className="flex items-center justify-between mb-8">
          {workflowSteps.map((step, i) => (
            <div key={step.name} className="flex items-center">
              <div className={`flex flex-col items-center transition-all duration-300 ${activeStep === i ? 'scale-110' : ''}`}>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-[11px] font-bold border-2 transition-all duration-300 ${activeStep === i ? 'shadow-lg' : ''}`}
                  style={{
                    backgroundColor: c(step.color, activeStep === i ? 20 : 8),
                    borderColor: activeStep === i ? step.color : 'transparent',
                    color: step.color,
                    boxShadow: activeStep === i ? `0 0 20px ${c(step.color, 15)}` : 'none',
                  }}>
                  {step.count}
                </div>
                <span className={`mt-2 text-[9px] font-[500] transition-colors duration-300 ${activeStep === i ? 'text-white' : 'text-[var(--landing-text-muted)]'}`}>{step.name}</span>
              </div>
              {i < workflowSteps.length - 1 && (
                <div className="flex-1 mx-2 flex items-center">
                  <div className="h-px flex-1 bg-[var(--landing-border)]" />
                  <ChevronRight className={`h-3 w-3 mx-0.5 transition-colors duration-300 ${activeStep === i ? 'text-white/40' : 'text-[var(--landing-border)]'}`} />
                  <div className="h-px flex-1 bg-[var(--landing-border)]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Transitions table */}
        <div className="rounded-lg border border-[var(--landing-border)] overflow-hidden">
          <div className="px-3 py-2 bg-white/[0.02] border-b border-[var(--landing-border)]">
            <span className="text-[10px] font-[500] uppercase tracking-wider text-[var(--landing-text-muted)]">Transition Rules</span>
          </div>
          {[
            { from: 'To Do', to: 'In Progress', rule: 'Assignee required', auto: false },
            { from: 'In Progress', to: 'In Review', rule: 'All subtasks complete', auto: true },
            { from: 'In Review', to: 'QA Testing', rule: 'Code review approved', auto: true },
            { from: 'QA Testing', to: 'Done', rule: 'QA sign-off', auto: false },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-[var(--landing-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors">
              <span className="text-[10px] text-[var(--landing-text)] w-20">{t.from}</span>
              <ArrowRight className="h-3 w-3 text-[var(--landing-text-muted)]" />
              <span className="text-[10px] text-[var(--landing-text)] w-20">{t.to}</span>
              <span className="text-[10px] text-[#F6F6F6]/40 flex-1">{t.rule}</span>
              {t.auto && <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Auto</span>}
            </div>
          ))}
        </div>
      </div>
    </ShowcaseFrame>
  );
}

/* ─── Sprint Showcase ─── */
export function SprintShowcase() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setProgress(p => p >= 72 ? 0 : p + 1), 40);
    return () => clearInterval(i);
  }, []);

  return (
    <ShowcaseFrame title="Sprints" url="tasknebula.io / Sprint 4 Overview">
      <div className="p-5 h-[320px]">
        {/* Sprint header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-[500] text-white">Sprint 4 — Auth & Notifications</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-[500] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />Active
              </span>
            </div>
            <p className="text-[11px] text-[var(--landing-text-muted)] mt-1">Mar 25 — Apr 8, 2026 · 14 days · 18 issues</p>
          </div>
          <div className="text-right">
            <span className="text-[20px] font-[500] text-white tabular-nums">{progress}%</span>
            <p className="text-[9px] text-[var(--landing-text-muted)]">5 days remaining</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total', value: '18', sub: 'issues' },
            { label: 'Done', value: '13', sub: 'completed' },
            { label: 'In Progress', value: '3', sub: 'active' },
            { label: 'Points', value: '42', sub: 'story pts' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-[var(--landing-border)] bg-white/[0.015] p-3">
              <p className="text-[9px] text-[var(--landing-text-muted)] mb-1">{s.label}</p>
              <p className="text-[18px] font-[500] text-white leading-none">{s.value}</p>
              <p className="text-[8px] text-[var(--landing-text-muted)] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Mini burndown */}
        <div className="rounded-lg border border-[var(--landing-border)] bg-white/[0.015] p-3">
          <span className="text-[9px] font-[500] uppercase tracking-wider text-[var(--landing-text-muted)]">Burndown</span>
          <div className="mt-2 flex items-end gap-1 h-[50px]">
            {[18, 17, 16, 15, 13, 11, 9, 7, 5, 5, 4, 3, 2, 0].map((v, i) => (
              <div key={i} className="flex-1 rounded-t transition-all duration-300" style={{
                height: `${(v / 18) * 100}%`,
                backgroundColor: i <= Math.floor(progress / 7.2) ? '#10b981' : c('#10b981', 20),
                minHeight: v > 0 ? 2 : 0,
              }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[7px] text-[var(--landing-text-muted)]">Day 1</span>
            <span className="text-[7px] text-[var(--landing-text-muted)]">Day 14</span>
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

/* ─── Analytics Showcase ─── */
export function AnalyticsShowcase() {
  return (
    <ShowcaseFrame title="Analytics" url="tasknebula.io / Project Analytics">
      <div className="p-5 h-[320px]">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Velocity', value: '23', change: '+12%', up: true },
            { label: 'Cycle Time', value: '2.4d', change: '-8%', up: false },
            { label: 'Throughput', value: '18/wk', change: '+5%', up: true },
            { label: 'Bug Rate', value: '4.2%', change: '-15%', up: false },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-[var(--landing-border)] bg-white/[0.015] p-3">
              <p className="text-[9px] text-[var(--landing-text-muted)]">{s.label}</p>
              <p className="text-[18px] font-[500] text-white leading-none mt-1">{s.value}</p>
              <p className={`text-[9px] mt-0.5 ${s.up ? 'text-emerald-400' : 'text-blue-400'}`}>{s.change}</p>
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="grid grid-cols-2 gap-3">
          {/* Velocity chart */}
          <div className="rounded-lg border border-[var(--landing-border)] bg-white/[0.015] p-3">
            <span className="text-[9px] font-[500] uppercase tracking-wider text-[var(--landing-text-muted)]">Sprint Velocity</span>
            <div className="mt-3 flex items-end gap-2 h-[80px]">
              {[14, 18, 16, 21, 19, 23].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[7px] text-[var(--landing-text-muted)] tabular-nums">{v}</span>
                  <div className="w-full rounded-t" style={{ height: `${(v / 25) * 100}%`, backgroundColor: i === 5 ? '#2ABBF8' : c('#2ABBF8', 30) }} />
                  <span className="text-[7px] text-[var(--landing-text-muted)]">S{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution */}
          <div className="rounded-lg border border-[var(--landing-border)] bg-white/[0.015] p-3">
            <span className="text-[9px] font-[500] uppercase tracking-wider text-[var(--landing-text-muted)]">By Priority</span>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Critical', value: 3, total: 42, color: '#ef4444' },
                { label: 'High', value: 12, total: 42, color: '#f97316' },
                { label: 'Medium', value: 18, total: 42, color: '#3b82f6' },
                { label: 'Low', value: 9, total: 42, color: '#94a3b8' },
              ].map(p => (
                <div key={p.label} className="flex items-center gap-2">
                  <span className="text-[9px] text-[var(--landing-text-muted)] w-12">{p.label}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(p.value / p.total) * 100}%`, backgroundColor: p.color }} />
                  </div>
                  <span className="text-[9px] text-[var(--landing-text-muted)] tabular-nums w-4 text-right">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

/* ════════════════════════════════════════════════════════
   SHARED — Window frame
   ════════════════════════════════════════════════════════ */
function ShowcaseFrame({ title, url, children }: { title: string; url: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-bg-card)]">
      <div className="flex items-center gap-2 border-b border-[var(--landing-border)] px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="rounded bg-[var(--landing-bg)] border border-[var(--landing-border)] px-3 py-0.5 text-[10px] text-[var(--landing-text-muted)] font-mono">{url}</div>
        </div>
      </div>
      {children}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8" style={{ background: 'linear-gradient(to top, var(--landing-bg-card), transparent)' }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   LEGACY EXPORT — kept for backward compat
   ════════════════════════════════════════════════════════ */
export function ProductShowcase() {
  return <HeroShowcase />;
}
