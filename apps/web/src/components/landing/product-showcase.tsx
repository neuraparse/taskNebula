'use client';

import type { DragEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bug,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { TaskNebulaLogo } from '@/components/branding/tasknebula-logo';

type IssueType = 'story' | 'task' | 'bug' | 'epic';
type Priority = 'critical' | 'high' | 'medium' | 'low';

type BoardIssue = {
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  col: number;
  assignee?: string;
  comments?: number;
  subtasks?: string;
  summary: string;
  checklist: string[];
};

type BoardView = {
  id: string;
  label: string;
  issues: BoardIssue[];
};

const typeIcon: Record<IssueType, { icon: typeof BookOpen; colorVar: string }> = {
  story: { icon: BookOpen, colorVar: 'var(--landing-accent-blue)' },
  task: { icon: CheckSquare, colorVar: 'var(--landing-accent-green)' },
  bug: { icon: Bug, colorVar: 'var(--landing-accent-rose)' },
  epic: { icon: Zap, colorVar: 'var(--landing-accent-violet)' },
};

const priorityColorVar: Record<Priority, string> = {
  critical: 'var(--landing-accent-rose)',
  high: 'var(--landing-accent-amber)',
  medium: 'var(--landing-accent-blue)',
  low: 'var(--landing-text-muted)',
};

const columns = [
  { name: 'Backlog', accentVar: 'var(--landing-text-muted)' },
  { name: 'To Do', accentVar: 'var(--landing-text-body)' },
  { name: 'In Progress', accentVar: 'var(--landing-accent-blue)' },
  { name: 'In Review', accentVar: 'var(--landing-accent-violet)' },
  { name: 'Done', accentVar: 'var(--landing-accent-green)' },
] as const;

const boardViews: BoardView[] = [
  {
    id: 'website',
    label: 'Website',
    issues: [
      {
        key: 'WEB-18',
        title: 'Refine launch page hierarchy',
        type: 'story',
        priority: 'high',
        col: 2,
        assignee: 'SK',
        comments: 4,
        subtasks: '3/5',
        summary: 'Tighten hero, simplify copy, and make the landing feel more premium.',
        checklist: ['Reduce copy density', 'Improve visual rhythm', 'Finalize CTA placement'],
      },
      {
        key: 'WEB-21',
        title: 'Docs intro for redesign project',
        type: 'task',
        priority: 'medium',
        col: 1,
        assignee: 'TL',
        summary: 'Create a project note structure linked to the main redesign issue.',
        checklist: ['Outline launch notes', 'Link blockers to docs', 'Add revision checkpoints'],
      },
      {
        key: 'WEB-24',
        title: 'Fix mobile footer alignment',
        type: 'bug',
        priority: 'critical',
        col: 3,
        assignee: 'DW',
        comments: 2,
        summary: 'Resolve spacing drift and prevent CTA overlap on smaller screens.',
        checklist: ['Audit breakpoints', 'Normalize spacing tokens', 'QA Safari mobile'],
      },
      {
        key: 'WEB-09',
        title: 'Release marketing epic',
        type: 'epic',
        priority: 'high',
        col: 0,
        assignee: 'MC',
        summary: 'Coordinate launch assets, copy, and release checklist for the redesign.',
        checklist: ['Finalize visuals', 'Lock release notes', 'Review analytics events'],
      },
      {
        key: 'WEB-05',
        title: 'Shipping checklist',
        type: 'task',
        priority: 'low',
        col: 4,
        assignee: 'AK',
        subtasks: '4/4',
        summary: 'Final deploy checklist for copy, assets, analytics, and docs.',
        checklist: ['Docs confirmed', 'Analytics checked', 'Post-launch owner assigned'],
      },
    ],
  },
  {
    id: 'api',
    label: 'API Platform',
    issues: [
      {
        key: 'API-12',
        title: 'Partner auth hardening',
        type: 'story',
        priority: 'high',
        col: 2,
        assignee: 'AK',
        comments: 5,
        summary: 'Tighten token refresh paths and rollout sequence for partner access.',
        checklist: ['Review token lifecycle', 'Lock scopes', 'Publish rollout note'],
      },
      {
        key: 'API-09',
        title: 'Rate limiting policy',
        type: 'task',
        priority: 'medium',
        col: 1,
        assignee: 'SC',
        summary: 'Define thresholds and recovery behavior for public endpoints.',
        checklist: ['Draft policy', 'Add dashboard checks', 'Review with support'],
      },
      {
        key: 'API-17',
        title: 'Webhook retry bug',
        type: 'bug',
        priority: 'critical',
        col: 3,
        assignee: 'DW',
        comments: 3,
        summary: 'Retry window is shorter than expected under queue pressure.',
        checklist: ['Reproduce in staging', 'Patch retry timing', 'Verify audit logging'],
      },
      {
        key: 'API-03',
        title: 'Versioning epic',
        type: 'epic',
        priority: 'high',
        col: 0,
        assignee: 'SK',
        summary: 'Shape versioning and migration guidance for upcoming platform changes.',
        checklist: ['Define policy', 'Write migration guide', 'Add rollout checklist'],
      },
      {
        key: 'API-22',
        title: 'Observability cleanup',
        type: 'task',
        priority: 'low',
        col: 4,
        assignee: 'TL',
        subtasks: '2/2',
        summary: 'Bring endpoint health signals and alerts into a cleaner baseline.',
        checklist: ['Refine alert names', 'Review dashboard cards', 'Close migration notes'],
      },
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    issues: [
      {
        key: 'APP-14',
        title: 'Offline queue polish',
        type: 'story',
        priority: 'high',
        col: 2,
        assignee: 'MC',
        comments: 4,
        summary: 'Make offline sync state clearer and reduce ambiguous empty states.',
        checklist: ['Review queue states', 'Refine copy', 'Test reconnect flow'],
      },
      {
        key: 'APP-11',
        title: 'Push preference setup',
        type: 'task',
        priority: 'medium',
        col: 1,
        assignee: 'SC',
        summary: 'Add better first-run setup for notifications and reminders.',
        checklist: ['Refine toggles', 'Clarify permission states', 'Document fallback flow'],
      },
      {
        key: 'APP-06',
        title: 'Board drag bug on tablets',
        type: 'bug',
        priority: 'critical',
        col: 3,
        assignee: 'DW',
        comments: 2,
        summary: 'Dragging cards feels sticky under split-screen tablet layouts.',
        checklist: ['Fix pointer capture', 'QA iPad split view', 'Verify velocity'],
      },
      {
        key: 'APP-02',
        title: 'Release readiness epic',
        type: 'epic',
        priority: 'high',
        col: 0,
        assignee: 'SK',
        summary: 'Coordinate release, QA, notes, and store assets for the mobile launch.',
        checklist: ['Store assets', 'Release notes', 'QA sign-off'],
      },
      {
        key: 'APP-19',
        title: 'Checklist sync done',
        type: 'task',
        priority: 'low',
        col: 4,
        assignee: 'AK',
        subtasks: '3/3',
        summary: 'Checklist sync is stable across devices and background reconnects.',
        checklist: ['Android check', 'iOS check', 'Docs update'],
      },
    ],
  },
];

const teamMembers = [
  {
    name: 'Sarah Kim',
    role: 'Product',
    initials: 'SK',
    colorVar: 'var(--landing-accent-blue)',
    status: 'Leading launch review',
  },
  {
    name: 'Abhay Kumar',
    role: 'Tech Lead',
    initials: 'AK',
    colorVar: 'var(--landing-accent-green)',
    status: 'Tracking API rollout',
  },
  {
    name: 'Danny Wong',
    role: 'Engineer',
    initials: 'DW',
    colorVar: 'var(--landing-accent-amber)',
    status: 'Finishing review fixes',
  },
  {
    name: 'Maria Chen',
    role: 'Design',
    initials: 'MC',
    colorVar: 'var(--landing-accent-violet)',
    status: 'Updating launch assets',
  },
] as const;

const activityFeed = [
  {
    who: 'SK',
    action: 'moved WEB-18 to In Review',
    time: 'just now',
    colorVar: 'var(--landing-accent-blue)',
  },
  {
    who: 'AK',
    action: 'linked docs to API-12',
    time: '4m ago',
    colorVar: 'var(--landing-accent-green)',
  },
  { who: 'DW', action: 'closed APP-19', time: '11m ago', colorVar: 'var(--landing-accent-amber)' },
] as const;

const workflowSteps = [
  { name: 'Backlog', colorVar: 'var(--landing-text-muted)', count: 12 },
  { name: 'To Do', colorVar: 'var(--landing-text-body)', count: 8 },
  { name: 'In Progress', colorVar: 'var(--landing-accent-blue)', count: 5 },
  { name: 'In Review', colorVar: 'var(--landing-accent-violet)', count: 3 },
  { name: 'Done', colorVar: 'var(--landing-accent-green)', count: 24 },
] as const;

const workflowRules = [
  { from: 'To Do', to: 'In Progress', rule: 'Assignee required', auto: false },
  { from: 'In Progress', to: 'In Review', rule: 'All subtasks complete', auto: true },
  { from: 'In Review', to: 'Done', rule: 'Review approved', auto: false },
] as const;

export function HeroShowcase() {
  const [boards, setBoards] = useState<BoardView[]>(() =>
    boardViews.map((board) => ({
      ...board,
      issues: board.issues.map((issue) => ({ ...issue })),
    }))
  );
  const [activeBoardId, setActiveBoardId] = useState(boardViews[0]?.id ?? '');
  const [selectedIssueKey, setSelectedIssueKey] = useState(boardViews[0]?.issues[0]?.key ?? '');
  const [draggingIssueKey, setDraggingIssueKey] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);

  const activeBoard = (boards.find((board) => board.id === activeBoardId) ??
    boards[0]) as BoardView;

  useEffect(() => {
    setSelectedIssueKey((current) => {
      if (activeBoard?.issues.some((issue) => issue.key === current)) {
        return current;
      }

      return activeBoard?.issues[0]?.key ?? '';
    });
  }, [activeBoard]);

  const selectedIssue =
    activeBoard?.issues.find((issue) => issue.key === selectedIssueKey) ?? activeBoard?.issues[0];

  const moveIssueToColumn = (issueKey: string, nextColumn: number) => {
    if (!activeBoard || nextColumn < 0 || nextColumn >= columns.length) {
      return;
    }

    setBoards((currentBoards) =>
      currentBoards.map((board) =>
        board.id === activeBoard.id
          ? {
              ...board,
              issues: board.issues.map((issue) =>
                issue.key === issueKey ? { ...issue, col: nextColumn } : issue
              ),
            }
          : board
      )
    );
    setSelectedIssueKey(issueKey);
  };

  const handleDrop = (columnIndex: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const issueKey = event.dataTransfer.getData('text/tasknebula-issue-key');

    if (issueKey) {
      moveIssueToColumn(issueKey, columnIndex);
    }

    setDraggingIssueKey(null);
    setDragOverColumn(null);
  };

  return (
    <section id="board" className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)]">
      <div className="mx-auto max-w-screen-xl px-4 py-20 sm:px-8 sm:py-24 lg:px-20">
        <div className="animate-fade-up mb-8 max-w-2xl">
          <span className="landing-kicker inline-flex items-center gap-2 text-[var(--landing-text-muted)]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: 'var(--landing-accent-blue)' }}
            />
            Board
          </span>
          <h2 className="landing-title mt-4 text-balance text-[34px] text-[var(--landing-text-dark)] sm:text-[42px] lg:text-[52px]">
            A board you can actually move through.
          </h2>
          <p className="landing-body mt-4 text-[15px] text-[var(--landing-text-subtle)]">
            Switch projects, drag issues between stages, and keep details close without fake motion
            or noisy chrome.
          </p>
        </div>

        <div className="animate-blur-in overflow-hidden rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)]">
          <ShowcaseHeader title="Board" url={`${activeBoard.label} / Current sprint`} />

          <div className="border-b border-[var(--landing-border)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => setActiveBoardId(board.id)}
                  className={`ease-snap rounded-sm border px-3 py-1.5 text-[11px] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] ${
                    board.id === activeBoard.id
                      ? 'border-[var(--landing-border-strong)] bg-[var(--landing-bg)] text-[var(--landing-text-dark)]'
                      : 'border-[var(--landing-border)] text-[var(--landing-text-muted)] hover:bg-[var(--landing-bg-surface)]'
                  }`}
                >
                  {board.label}
                </button>
              ))}
              <span className="ml-auto hidden text-[11px] text-[var(--landing-text-muted)] lg:block">
                Drag cards between stages.
              </span>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="scrollbar-none max-w-full overflow-x-auto overscroll-x-contain pb-1">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[980px] lg:auto-cols-[188px] lg:grid-flow-col lg:grid-cols-none xl:min-w-0 xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-5">
                {columns.map((column, columnIndex) => {
                  const columnCards = activeBoard.issues.filter(
                    (issue) => issue.col === columnIndex
                  );

                  return (
                    <div
                      key={column.name}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverColumn(columnIndex);
                      }}
                      onDragLeave={() => {
                        if (dragOverColumn === columnIndex) {
                          setDragOverColumn(null);
                        }
                      }}
                      onDrop={handleDrop(columnIndex)}
                      className={`min-w-0 rounded-md border bg-[var(--landing-bg-surface)] transition-colors duration-200 ${
                        dragOverColumn === columnIndex
                          ? 'border-[var(--landing-border-strong)] bg-[var(--landing-bg-elevated)]'
                          : 'border-[var(--landing-border)]'
                      }`}
                      style={{ borderTopColor: column.accentVar, borderTopWidth: 2 }}
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-3">
                        <span className="text-[10px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-body)]">
                          {column.name}
                        </span>
                        <span className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2 py-0.5 text-[9px] font-bold tabular-nums text-[var(--landing-text-muted)]">
                          {columnCards.length}
                        </span>
                      </div>
                      <div className="min-h-[212px] space-y-2 px-2 pb-2">
                        {columnCards.length ? (
                          columnCards.map((card) => (
                            <MiniCard
                              key={card.key}
                              card={card}
                              isSelected={card.key === selectedIssue?.key}
                              isDragging={draggingIssueKey === card.key}
                              onSelect={() => setSelectedIssueKey(card.key)}
                              onDragStart={() => {
                                setDraggingIssueKey(card.key);
                                setSelectedIssueKey(card.key);
                              }}
                              onDragEnd={() => {
                                setDraggingIssueKey(null);
                                setDragOverColumn(null);
                              }}
                            />
                          ))
                        ) : (
                          <EmptyColumnState />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedIssue ? (
              <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-4">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-[var(--landing-text-muted)]">
                        {selectedIssue.key}
                      </span>
                      <span
                        className="rounded-sm px-2 py-1 text-[10px]"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${priorityColorVar[selectedIssue.priority]} 12%, transparent)`,
                          color: priorityColorVar[selectedIssue.priority],
                        }}
                      >
                        {selectedIssue.priority}
                      </span>
                    </div>

                    <h3 className="mt-4 text-[22px] font-[520] leading-8 text-[var(--landing-text-dark)]">
                      {selectedIssue.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[var(--landing-text-muted)]">
                      {selectedIssue.summary}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <MetaChip label={`Stage ${columns[selectedIssue.col]?.name ?? 'Unknown'}`} />
                      {selectedIssue.assignee ? (
                        <MetaChip label={`Owner ${selectedIssue.assignee}`} />
                      ) : null}
                      {selectedIssue.comments ? (
                        <MetaChip label={`${selectedIssue.comments} comments`} />
                      ) : null}
                      {selectedIssue.subtasks ? <MetaChip label={selectedIssue.subtasks} /> : null}
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveIssueToColumn(selectedIssue.key, selectedIssue.col - 1)}
                        disabled={selectedIssue.col === 0}
                        className="ease-snap inline-flex h-9 items-center rounded-sm border border-[var(--landing-border)] px-3 text-[12px] text-[var(--landing-text)] transition-all duration-150 hover:bg-[var(--landing-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Move back
                      </button>
                      <button
                        type="button"
                        onClick={() => moveIssueToColumn(selectedIssue.key, selectedIssue.col + 1)}
                        disabled={selectedIssue.col === columns.length - 1}
                        className="ease-snap inline-flex h-9 items-center rounded-sm border border-[var(--landing-border-strong)] bg-[var(--landing-bg)] px-3 text-[12px] text-[var(--landing-text-dark)] transition-all duration-150 hover:bg-[var(--landing-bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Move forward
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[var(--landing-border)] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <p className="text-[10px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
                      Checklist
                    </p>
                    <div className="mt-4 space-y-3">
                      {selectedIssue.checklist.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-3 text-[13px] text-[var(--landing-text)]"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--landing-accent-green)]" />
                          <span className="leading-6">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniCard({
  card,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  card: BoardIssue;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const cardType = typeIcon[card.type];
  const Icon = cardType.icon;

  return (
    <button
      type="button"
      draggable
      onClick={onSelect}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/tasknebula-issue-key', card.key);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`ease-snap relative w-full cursor-grab overflow-hidden rounded-sm border bg-[var(--landing-bg)] p-2.5 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)] active:cursor-grabbing ${
        isSelected
          ? 'border-[var(--landing-border-strong)] bg-[var(--landing-bg-elevated)]'
          : 'border-[var(--landing-border)] hover:border-[var(--landing-border-strong)]'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ backgroundColor: priorityColorVar[card.priority] }}
      />
      <div className="mb-1.5 flex items-center justify-between pl-1">
        <div className="flex items-center gap-1">
          <Icon className="h-2.5 w-2.5" style={{ color: cardType.colorVar }} />
          <span className="font-mono text-[9px] text-[var(--landing-text-muted)]">{card.key}</span>
        </div>
        {card.assignee ? (
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] text-[7px] font-bold text-[var(--landing-text-body)]">
            {card.assignee}
          </div>
        ) : null}
      </div>

      <p className="line-clamp-2 pl-1 text-[10px] font-[420] leading-[1.45] text-[var(--landing-text)]">
        {card.title}
      </p>

      {card.comments || card.subtasks ? (
        <div className="mt-2 flex items-center gap-2 border-t border-[var(--landing-border)] pl-1 pt-1.5">
          {card.subtasks ? (
            <span className="flex items-center gap-0.5 text-[8px] text-[var(--landing-text-muted)]">
              <CheckCircle2 className="h-2 w-2" />
              {card.subtasks}
            </span>
          ) : null}
          {card.comments ? (
            <span className="flex items-center gap-0.5 text-[8px] text-[var(--landing-text-muted)]">
              <MessageSquare className="h-2 w-2" />
              {card.comments}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-2.5 py-1 text-[11px] text-[var(--landing-text-muted)]">
      {label}
    </span>
  );
}

function EmptyColumnState() {
  return (
    <div className="bg-[var(--landing-bg)]/35 flex min-h-[152px] items-center justify-center rounded-sm border border-dashed border-[var(--landing-border)] px-3 text-center text-[11px] text-[var(--landing-text-muted)]">
      Drop an issue here
    </div>
  );
}

export function TeamShowcase() {
  return (
    <ShowcaseFrame title="Team" url="Workspace / Team">
      <div className="grid h-[340px] grid-cols-[220px_1fr]">
        <div className="overflow-hidden border-r border-[var(--landing-border)]">
          <div className="border-b border-[var(--landing-border)] px-3 py-2">
            <span className="text-[10px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              Members
            </span>
          </div>
          {teamMembers.map((member, index) => (
            <div
              key={member.initials}
              className={`flex items-center gap-2.5 border-b border-[var(--landing-border)] px-3 py-2 last:border-b-0 ${
                index === 0 ? 'bg-[var(--landing-bg-surface)]' : ''
              }`}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${member.colorVar} 12%, transparent)`,
                  color: member.colorVar,
                }}
              >
                {member.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-[500] text-[var(--landing-text)]">
                  {member.name}
                </p>
                <p className="truncate text-[9px] text-[var(--landing-text-muted)]">
                  {member.role}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3">
          <span className="text-[10px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
            Activity
          </span>
          <div className="mt-3 space-y-3">
            {activityFeed.map((entry) => (
              <div key={`${entry.who}-${entry.time}`} className="flex items-start gap-2.5">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${entry.colorVar} 12%, transparent)`,
                    color: entry.colorVar,
                  }}
                >
                  {entry.who}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[var(--landing-text)]">{entry.action}</p>
                  <p className="text-[9px] text-[var(--landing-text-muted)]">{entry.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

export function WorkflowShowcase() {
  const activeStep = 2;

  return (
    <ShowcaseFrame title="Workflow" url="Project settings / Workflow">
      <div className="h-[320px] p-5">
        <div className="mb-8 flex items-center justify-between">
          {workflowSteps.map((step, index) => (
            <div key={step.name} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-sm border-2 text-[11px] font-bold"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${step.colorVar} ${index === activeStep ? 16 : 6}%, transparent)`,
                    borderColor: index === activeStep ? step.colorVar : 'transparent',
                    color: step.colorVar,
                  }}
                >
                  {step.count}
                </div>
                <span
                  className={`mt-2 text-[9px] ${index === activeStep ? 'text-[var(--landing-text-dark)]' : 'text-[var(--landing-text-muted)]'}`}
                >
                  {step.name}
                </span>
              </div>
              {index < workflowSteps.length - 1 ? (
                <div className="mx-2 flex flex-1 items-center">
                  <div className="h-px flex-1 bg-[var(--landing-border)]" />
                  <ChevronRight className="mx-0.5 h-3 w-3 text-[var(--landing-border)]" />
                  <div className="h-px flex-1 bg-[var(--landing-border)]" />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-[var(--landing-border)]">
          <div className="border-b border-[var(--landing-border)] bg-[var(--landing-bg-surface)] px-3 py-2">
            <span className="text-[10px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              Transition rules
            </span>
          </div>
          {workflowRules.map((rule) => (
            <div
              key={`${rule.from}-${rule.to}`}
              className="flex items-center gap-3 border-b border-[var(--landing-border)] px-3 py-2 last:border-b-0"
            >
              <span className="w-20 text-[10px] text-[var(--landing-text)]">{rule.from}</span>
              <ArrowRight className="h-3 w-3 text-[var(--landing-text-muted)]" />
              <span className="w-20 text-[10px] text-[var(--landing-text)]">{rule.to}</span>
              <span className="flex-1 text-[10px] text-[var(--landing-text-muted)]">
                {rule.rule}
              </span>
              {rule.auto ? (
                <span
                  className="rounded-sm border px-1.5 py-0.5 text-[8px]"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--landing-accent-blue) 20%, transparent)',
                    backgroundColor:
                      'color-mix(in srgb, var(--landing-accent-blue) 10%, transparent)',
                    color: 'var(--landing-accent-blue)',
                  }}
                >
                  Auto
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </ShowcaseFrame>
  );
}

export function SprintShowcase() {
  const progress = 72;
  const burndown = [18, 17, 16, 15, 13, 11, 9, 7, 5, 5, 4, 3, 2, 0];

  return (
    <ShowcaseFrame title="Sprint" url="Sprint 4 / Overview">
      <div className="h-[320px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-[500] text-[var(--landing-text-dark)]">
                Sprint 4 — Auth &amp; Notifications
              </span>
              <span className="live-pill">Active</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--landing-text-muted)]">14 days · 18 issues</p>
          </div>
          <div className="text-right">
            <span className="text-[20px] font-[500] tabular-nums text-[var(--landing-text-dark)]">
              {progress}%
            </span>
            <p className="text-[9px] text-[var(--landing-text-muted)]">5 days remaining</p>
          </div>
        </div>

        <div className="mb-6 h-2 overflow-hidden rounded-full bg-[var(--landing-bg-surface)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background:
                'linear-gradient(to right, var(--landing-accent-green), var(--landing-accent-blue))',
            }}
          />
        </div>

        <div className="mb-5 grid grid-cols-4 gap-3">
          {[
            { label: 'Total', value: '18' },
            { label: 'Done', value: '13' },
            { label: 'Active', value: '3' },
            { label: 'Points', value: '42' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3"
            >
              <p className="mb-1 text-[9px] text-[var(--landing-text-muted)]">{stat.label}</p>
              <p className="text-[18px] font-[500] leading-none text-[var(--landing-text-dark)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
          <span className="text-[9px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
            Burndown
          </span>
          <div className="mt-2 flex h-[50px] items-end gap-1">
            {burndown.map((value, index) => (
              <div
                key={index}
                className="flex-1 rounded-t"
                style={{
                  height: `${(value / 18) * 100}%`,
                  backgroundColor:
                    index <= Math.floor(progress / 7.2)
                      ? 'var(--landing-accent-green)'
                      : 'color-mix(in srgb, var(--landing-accent-green) 20%, transparent)',
                  minHeight: value > 0 ? 2 : 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

export function AnalyticsShowcase() {
  return (
    <ShowcaseFrame title="Analytics" url="Project / Analytics">
      <div className="h-[320px] p-5">
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[
            { label: 'Velocity', value: '23', change: '+12%' },
            { label: 'Cycle', value: '2.4d', change: '-8%' },
            { label: 'Flow', value: '18/wk', change: '+5%' },
            { label: 'Bugs', value: '4.2%', change: '-15%' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3"
            >
              <p className="text-[9px] text-[var(--landing-text-muted)]">{stat.label}</p>
              <p className="mt-1 text-[18px] font-[500] leading-none text-[var(--landing-text-dark)]">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[9px] text-[var(--landing-text-muted)]">{stat.change}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
            <span className="text-[9px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              Velocity
            </span>
            <div className="mt-3 flex h-[80px] items-end gap-2">
              {[14, 18, 16, 21, 19, 23].map((value, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${(value / 25) * 100}%`,
                      backgroundColor:
                        index === 5
                          ? 'var(--landing-accent-blue)'
                          : 'color-mix(in srgb, var(--landing-accent-blue) 30%, transparent)',
                    }}
                  />
                  <span className="text-[7px] text-[var(--landing-text-muted)]">S{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg-surface)] p-3">
            <span className="text-[9px] font-[500] uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              Priority mix
            </span>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Critical', value: 3, total: 42, colorVar: 'var(--landing-accent-rose)' },
                { label: 'High', value: 12, total: 42, colorVar: 'var(--landing-accent-amber)' },
                { label: 'Medium', value: 18, total: 42, colorVar: 'var(--landing-accent-blue)' },
                { label: 'Low', value: 9, total: 42, colorVar: 'var(--landing-text-muted)' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-12 text-[9px] text-[var(--landing-text-muted)]">
                    {item.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--landing-bg)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(item.value / item.total) * 100}%`,
                        backgroundColor: item.colorVar,
                      }}
                    />
                  </div>
                  <span className="w-4 text-right text-[9px] text-[var(--landing-text-muted)]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

function ShowcaseFrame({
  title,
  url,
  children,
}: {
  title: string;
  url: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg-card)]">
      <ShowcaseHeader title={title} url={url} />
      {children}
    </div>
  );
}

function ShowcaseHeader({ title, url }: { title: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--landing-border)] px-4 py-3">
      <div className="flex items-center gap-3">
        <TaskNebulaLogo compact variant="mono" className="text-[var(--landing-accent-blue)]" />
        <div>
          <p className="text-[12px] font-medium text-[var(--landing-text-dark)]">
            TaskNebula {title}
          </p>
          <p className="text-[10px] text-[var(--landing-text-muted)]">Workspace preview</p>
        </div>
      </div>
      <div className="inline-flex items-center gap-2">
        <span className="live-pill">Live</span>
        <span className="rounded-sm border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-1 text-[10px] text-[var(--landing-text-muted)]">
          {url}
        </span>
      </div>
    </div>
  );
}

export function ProductShowcase() {
  return <HeroShowcase />;
}
