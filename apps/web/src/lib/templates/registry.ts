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

export type TemplateCategory = 'engineering' | 'design' | 'product' | 'qa' | 'ops' | 'general';

export type TemplateWorkItemType = 'story' | 'bug' | 'task' | 'epic';

export type BuiltInTemplateKey =
  | 'bug_report'
  | 'feature_request'
  | 'tech_debt'
  | 'spike'
  | 'design_review'
  | 'qa_test_plan'
  | 'incident_postmortem'
  | 'product_launch_checklist'
  | 'customer_interview'
  | 'refactor_proposal';

export interface WorkItemTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  type: TemplateWorkItemType;
  i18nKey?: BuiltInTemplateKey;
  /** Single emoji used as the visual tile in the catalog. */
  icon: string;
  /** Markdown body template. May contain `{{placeholder}}` tokens. */
  body: string;
  labels: string[];
  estimatePoints?: number;
  subItems?: { title: string; i18nKey?: string }[];
}

export const TEMPLATE_CATEGORIES: ReadonlyArray<{
  value: TemplateCategory;
}> = [
  { value: 'engineering' },
  { value: 'design' },
  { value: 'product' },
  { value: 'qa' },
  { value: 'ops' },
  { value: 'general' },
];

export const WORK_ITEM_TEMPLATES: WorkItemTemplate[] = [
  {
    id: 'bug-report',
    i18nKey: 'bug_report',
    name: 'planning.starterTemplates.bug_report.name',
    description: 'planning.starterTemplates.bug_report.description',
    category: 'engineering',
    type: 'bug',
    icon: '🐛',
    labels: ['bug', 'triage'],
    estimatePoints: 2,
    body: 'planning.starterTemplates.bug_report.body',
  },
  {
    id: 'feature-request',
    i18nKey: 'feature_request',
    name: 'planning.starterTemplates.feature_request.name',
    description: 'planning.starterTemplates.feature_request.description',
    category: 'product',
    type: 'story',
    icon: '✨',
    labels: ['feature', 'discovery'],
    estimatePoints: 5,
    body: 'planning.starterTemplates.feature_request.body',
  },
  {
    id: 'tech-debt',
    i18nKey: 'tech_debt',
    name: 'planning.starterTemplates.tech_debt.name',
    description: 'planning.starterTemplates.tech_debt.description',
    category: 'engineering',
    type: 'task',
    icon: '🛠',
    labels: ['tech-debt', 'maintenance'],
    estimatePoints: 3,
    body: 'planning.starterTemplates.tech_debt.body',
  },
  {
    id: 'spike',
    i18nKey: 'spike',
    name: 'planning.starterTemplates.spike.name',
    description: 'planning.starterTemplates.spike.description',
    category: 'engineering',
    type: 'task',
    icon: '🔍',
    labels: ['spike', 'research'],
    estimatePoints: 2,
    body: 'planning.starterTemplates.spike.body',
  },
  {
    id: 'design-review',
    i18nKey: 'design_review',
    name: 'planning.starterTemplates.design_review.name',
    description: 'planning.starterTemplates.design_review.description',
    category: 'design',
    type: 'task',
    icon: '🎨',
    labels: ['design', 'review'],
    estimatePoints: 1,
    body: 'planning.starterTemplates.design_review.body',
  },
  {
    id: 'qa-test-plan',
    i18nKey: 'qa_test_plan',
    name: 'planning.starterTemplates.qa_test_plan.name',
    description: 'planning.starterTemplates.qa_test_plan.description',
    category: 'qa',
    type: 'task',
    icon: '✅',
    labels: ['qa', 'test-plan'],
    estimatePoints: 3,
    subItems: [
      {
        title: 'planning.starterTemplates.qa_test_plan.subItems.happy_path',
        i18nKey: 'happy_path',
      },
      {
        title: 'planning.starterTemplates.qa_test_plan.subItems.edge_cases',
        i18nKey: 'edge_cases',
      },
      {
        title: 'planning.starterTemplates.qa_test_plan.subItems.regression',
        i18nKey: 'regression',
      },
    ],
    body: 'planning.starterTemplates.qa_test_plan.body',
  },
  {
    id: 'incident-postmortem',
    i18nKey: 'incident_postmortem',
    name: 'planning.starterTemplates.incident_postmortem.name',
    description: 'planning.starterTemplates.incident_postmortem.description',
    category: 'ops',
    type: 'task',
    icon: '🔥',
    labels: ['incident', 'postmortem'],
    estimatePoints: 5,
    body: 'planning.starterTemplates.incident_postmortem.body',
  },
  {
    id: 'product-launch-checklist',
    i18nKey: 'product_launch_checklist',
    name: 'planning.starterTemplates.product_launch_checklist.name',
    description: 'planning.starterTemplates.product_launch_checklist.description',
    category: 'product',
    type: 'epic',
    icon: '🚀',
    labels: ['launch', 'cross-functional'],
    estimatePoints: 13,
    subItems: [
      {
        title: 'planning.starterTemplates.product_launch_checklist.subItems.marketing',
        i18nKey: 'marketing',
      },
      {
        title: 'planning.starterTemplates.product_launch_checklist.subItems.docs',
        i18nKey: 'docs',
      },
      {
        title: 'planning.starterTemplates.product_launch_checklist.subItems.support_enablement',
        i18nKey: 'support_enablement',
      },
      {
        title: 'planning.starterTemplates.product_launch_checklist.subItems.pricing',
        i18nKey: 'pricing',
      },
      {
        title: 'planning.starterTemplates.product_launch_checklist.subItems.sales_kickoff',
        i18nKey: 'sales_kickoff',
      },
    ],
    body: 'planning.starterTemplates.product_launch_checklist.body',
  },
  {
    id: 'customer-interview',
    i18nKey: 'customer_interview',
    name: 'planning.starterTemplates.customer_interview.name',
    description: 'planning.starterTemplates.customer_interview.description',
    category: 'product',
    type: 'task',
    icon: '💬',
    labels: ['discovery', 'research'],
    estimatePoints: 1,
    body: 'planning.starterTemplates.customer_interview.body',
  },
  {
    id: 'refactor-proposal',
    i18nKey: 'refactor_proposal',
    name: 'planning.starterTemplates.refactor_proposal.name',
    description: 'planning.starterTemplates.refactor_proposal.description',
    category: 'engineering',
    type: 'story',
    icon: '🧹',
    labels: ['refactor', 'proposal'],
    estimatePoints: 8,
    body: 'planning.starterTemplates.refactor_proposal.body',
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
