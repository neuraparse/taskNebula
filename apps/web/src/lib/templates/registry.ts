/**
 * Work-item template registry.
 *
 * Templates pre-populate work-item title, description (markdown body),
 * labels, estimate, and optional sub-items. Bodies may contain
 * `{{placeholder}}` tokens that the instantiation flow can replace
 * (e.g. `{{summary}}`, `{{owner}}`, `{{date}}`).
 *
 * This module is the canonical source of truth for the Templates browser.
 * Keep it pure (no React, no client-only APIs) so it can be imported
 * from server components, route handlers, and tests alike.
 */

export type TemplateCategory =
  | 'engineering'
  | 'design'
  | 'product'
  | 'qa'
  | 'ops'
  | 'general';

export type TemplateWorkItemType = 'story' | 'bug' | 'task' | 'epic';

export interface WorkItemTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  type: TemplateWorkItemType;
  /** Single emoji used as the visual tile in the catalog. */
  icon: string;
  /** Markdown body template. May contain `{{placeholder}}` tokens. */
  body: string;
  labels: string[];
  estimatePoints?: number;
  subItems?: { title: string }[];
}

export const TEMPLATE_CATEGORIES: ReadonlyArray<{
  value: TemplateCategory;
  label: string;
}> = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'product', label: 'Product' },
  { value: 'qa', label: 'QA' },
  { value: 'ops', label: 'Ops' },
  { value: 'general', label: 'General' },
];

export const WORK_ITEM_TEMPLATES: WorkItemTemplate[] = [
  {
    id: 'bug-report',
    name: 'Bug report',
    description:
      'Capture a defect with reproduction steps, expected vs. actual behavior, and environment.',
    category: 'engineering',
    type: 'bug',
    icon: '🐛',
    labels: ['bug', 'triage'],
    estimatePoints: 2,
    body: [
      '## Summary',
      '{{summary}}',
      '',
      '## Steps to reproduce',
      '1. ',
      '2. ',
      '3. ',
      '',
      '## Expected behavior',
      '{{expected}}',
      '',
      '## Actual behavior',
      '{{actual}}',
      '',
      '## Environment',
      '- App version: {{version}}',
      '- Browser / OS: {{environment}}',
      '',
      '## Additional context',
      '{{notes}}',
    ].join('\n'),
  },
  {
    id: 'feature-request',
    name: 'Feature request',
    description:
      'Frame a new capability as a user story with measurable acceptance criteria.',
    category: 'product',
    type: 'story',
    icon: '✨',
    labels: ['feature', 'discovery'],
    estimatePoints: 5,
    body: [
      '## User story',
      'As a **{{persona}}**, I want **{{capability}}**, so that **{{outcome}}**.',
      '',
      '## Acceptance criteria',
      '- [ ] ',
      '- [ ] ',
      '- [ ] ',
      '',
      '## Out of scope',
      '- ',
      '',
      '## Notes',
      '{{notes}}',
    ].join('\n'),
  },
  {
    id: 'tech-debt',
    name: 'Tech debt',
    description:
      'Track and justify a refactor or hardening task with risk and approach.',
    category: 'engineering',
    type: 'task',
    icon: '🛠',
    labels: ['tech-debt', 'maintenance'],
    estimatePoints: 3,
    body: [
      '## Context',
      '{{context}}',
      '',
      '## Risk if untouched',
      '{{risk}}',
      '',
      '## Proposed approach',
      '{{approach}}',
      '',
      '## Definition of done',
      '- [ ] Code change merged',
      '- [ ] Tests updated',
      '- [ ] No regression in metrics',
    ].join('\n'),
  },
  {
    id: 'spike',
    name: 'Spike',
    description:
      'Time-boxed investigation to reduce uncertainty before committing to delivery.',
    category: 'engineering',
    type: 'task',
    icon: '🔍',
    labels: ['spike', 'research'],
    estimatePoints: 2,
    body: [
      '## Question to answer',
      '{{question}}',
      '',
      '## Time-box',
      '{{timebox}}',
      '',
      '## Approach',
      '- ',
      '',
      '## Deliverable',
      'A short write-up + recommendation posted to this ticket.',
    ].join('\n'),
  },
  {
    id: 'design-review',
    name: 'Design review',
    description:
      'Schedule a critique of a flow, screen, or component with reviewers and goals.',
    category: 'design',
    type: 'task',
    icon: '🎨',
    labels: ['design', 'review'],
    estimatePoints: 1,
    body: [
      '## Artifact',
      '{{figma_link}}',
      '',
      '## Reviewers',
      '- ',
      '',
      '## Goals',
      '- ',
      '',
      '## Open questions',
      '- ',
    ].join('\n'),
  },
  {
    id: 'qa-test-plan',
    name: 'QA test plan',
    description:
      'Outline coverage for happy path, edge cases, and regression for a release.',
    category: 'qa',
    type: 'task',
    icon: '✅',
    labels: ['qa', 'test-plan'],
    estimatePoints: 3,
    subItems: [
      { title: 'Happy path' },
      { title: 'Edge cases' },
      { title: 'Regression' },
    ],
    body: [
      '## Scope',
      '{{scope}}',
      '',
      '## Environments',
      '- ',
      '',
      '## Exit criteria',
      '- All sub-items pass',
      '- No P0/P1 defects open',
    ].join('\n'),
  },
  {
    id: 'incident-postmortem',
    name: 'Incident postmortem',
    description:
      'Blameless write-up covering timeline, impact, root cause, and follow-up actions.',
    category: 'ops',
    type: 'task',
    icon: '🔥',
    labels: ['incident', 'postmortem'],
    estimatePoints: 5,
    body: [
      '## Summary',
      '{{summary}}',
      '',
      '## Timeline',
      '- {{time}} — ',
      '',
      '## Impact',
      '{{impact}}',
      '',
      '## Root cause',
      '{{root_cause}}',
      '',
      '## What went well',
      '- ',
      '',
      '## What went poorly',
      '- ',
      '',
      '## Action items',
      '- [ ] ',
      '- [ ] ',
    ].join('\n'),
  },
  {
    id: 'product-launch-checklist',
    name: 'Product launch checklist',
    description:
      'Coordinate cross-functional readiness across marketing, docs, support, pricing, and sales.',
    category: 'product',
    type: 'epic',
    icon: '🚀',
    labels: ['launch', 'cross-functional'],
    estimatePoints: 13,
    subItems: [
      { title: 'Marketing' },
      { title: 'Docs' },
      { title: 'Support enablement' },
      { title: 'Pricing' },
      { title: 'Sales kickoff' },
    ],
    body: [
      '## Launch overview',
      '{{summary}}',
      '',
      '## Target date',
      '{{date}}',
      '',
      '## DRI',
      '{{owner}}',
      '',
      '## Workstreams',
      'See sub-items below. Each owner adds status notes here.',
    ].join('\n'),
  },
  {
    id: 'customer-interview',
    name: 'Customer interview',
    description:
      'Discovery call template with goals, script prompts, and a place for notes.',
    category: 'product',
    type: 'task',
    icon: '💬',
    labels: ['discovery', 'research'],
    estimatePoints: 1,
    body: [
      '## Customer',
      '{{customer}}',
      '',
      '## Interview goals',
      '- ',
      '',
      '## Script',
      '1. Tell me about your current workflow.',
      '2. Where does it break down?',
      '3. What would "great" look like?',
      '',
      '## Notes',
      '{{notes}}',
      '',
      '## Follow-ups',
      '- [ ] ',
    ].join('\n'),
  },
  {
    id: 'refactor-proposal',
    name: 'Refactor proposal',
    description:
      'Pitch a structural change with motivation, alternatives, and a migration plan.',
    category: 'engineering',
    type: 'story',
    icon: '🧹',
    labels: ['refactor', 'proposal'],
    estimatePoints: 8,
    body: [
      '## Motivation',
      '{{motivation}}',
      '',
      '## Current state',
      '{{current}}',
      '',
      '## Proposed state',
      '{{proposed}}',
      '',
      '## Alternatives considered',
      '- ',
      '',
      '## Migration plan',
      '1. ',
      '2. ',
      '3. ',
      '',
      '## Rollback plan',
      '- ',
    ].join('\n'),
  },
];

/**
 * Stub instantiation result. Real implementations should `POST /api/issues`
 * (or the equivalent) using the resolved fields and return the created id.
 */
export interface InstantiatedTemplate {
  templateId: string;
  title: string;
  body: string;
  type: TemplateWorkItemType;
  labels: string[];
  estimatePoints?: number;
  subItems: { title: string }[];
}

export function instantiateTemplate(
  template: WorkItemTemplate,
  overrides?: { title?: string }
): InstantiatedTemplate {
  return {
    templateId: template.id,
    title: overrides?.title ?? template.name,
    body: template.body,
    type: template.type,
    labels: [...template.labels],
    estimatePoints: template.estimatePoints,
    subItems: template.subItems ? template.subItems.map((s) => ({ ...s })) : [],
  };
}
