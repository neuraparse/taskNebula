/**
 * AI Model Cards — public, human-readable disclosures for every AI feature
 * TaskNebula exposes to end users.
 *
 * Required by EU AI Act Article 50 (enforced 2026-08-02): for each AI system
 * deployed, the provider/deployer must publish in clear language the
 * intended purpose, model identity, data inputs, retention, human oversight
 * arrangements, and how to opt out. This file is the single source of truth
 * that drives both:
 *   - the public /ai-model-cards page
 *   - the workspace settings page (/settings/ai-transparency)
 *   - the AiBadge tooltip + first-time disclosure modal copy
 *
 * Editing the contents of any card or the DISCLOSURE_VERSION constant will
 * re-prompt every user to acknowledge the modal on their next AI surface
 * interaction.
 */

/** Bump this whenever the disclosure copy materially changes. */
export const DISCLOSURE_VERSION = '2026-05-14.1';

export type AiFeatureId =
  | 'draft'
  | 'assist'
  | 'triage'
  | 'ask'
  | 'summary'
  | 'embedding';

export interface AiFeatureModelCard {
  id: AiFeatureId;
  /** Human display name surfaced in UI and tooltip. */
  name: string;
  /** Short single-line description of what the feature does. */
  summary: string;
  /** Intended purpose in plain language (EU AI Act Art. 50). */
  purpose: string;
  /** Model identifier shown to users (e.g. "Claude Sonnet 4.7"). */
  defaultModel: string;
  /** Provider key for backend routing. */
  defaultProvider: 'anthropic' | 'openai' | 'azure' | 'native' | 'custom';
  /** Concrete data fields sent to the model on every call. */
  dataSent: string[];
  /** Data NOT sent — useful negative assertion for compliance docs. */
  dataNotSent: string[];
  /** Retention policy in plain language. */
  retention: string;
  /** Default human-oversight posture. */
  defaultOversight: 'auto' | 'review_required';
  /** Whether outputs are user-facing and require an AiBadge. */
  userFacing: boolean;
  /** Markdown body for the public model card page. */
  markdown: string;
}

export const AI_FEATURE_MODEL_CARDS: readonly AiFeatureModelCard[] = [
  {
    id: 'draft',
    name: 'Draft Issue',
    summary: 'Generates issue drafts (title, type, priority, labels) from a free-text prompt.',
    purpose:
      'Reduce the time it takes a human to convert a rough idea, bug report, or planning note into one or more well-structured TaskNebula issues. The model proposes content; the human reviews and creates.',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    dataSent: [
      'User-typed prompt',
      'Project name (for context)',
      'Available issue types and priorities',
    ],
    dataNotSent: [
      'Existing issue history or comments',
      'Member email addresses or PII',
      'Attachments or files',
    ],
    retention:
      'Prompt and response are stored in the agent_runs log for 90 days for audit, then purged.',
    defaultOversight: 'review_required',
    userFacing: true,
    markdown: `## Draft Issue

**What it does.** When you click *Draft with AI*, TaskNebula sends your free-text
prompt and basic project context to the configured model. The model returns one
or more draft issue cards (title, type, priority, labels, description). Nothing
is written to your project until you click *Confirm* — a human always reviews
the output.

**Model.** Claude Sonnet 4.7 (Anthropic) by default. Workspace admins may swap
the model from *Settings → AI & Agents → Models*.

**Data sent.** Your prompt, the project name, and the list of available issue
types and priorities.

**Data not sent.** Existing issue content, comments, attachments, or any PII
about other workspace members.

**Retention.** Prompt and response are retained for 90 days in the audit log,
then purged.

**Human oversight.** Outputs are always presented for review before they
become issues. There is no auto-apply path.

**Opt out.** Disable the Draft toggle in *Settings → AI Transparency*.
`,
  },
  {
    id: 'assist',
    name: 'Issue Assist',
    summary: 'Summarises, rewrites, suggests next steps, and labels for an existing issue.',
    purpose:
      'Help a human author write a clearer issue description, label set, or status update — never to modify the issue without a click-through Apply step.',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    dataSent: [
      'Issue title and description',
      'Existing labels',
      'Most recent comments (truncated)',
    ],
    dataNotSent: ['Linked issue contents', 'Attachments', 'Other workspace data'],
    retention:
      'Inputs and outputs are stored in the agent_runs log for 90 days, then purged.',
    defaultOversight: 'review_required',
    userFacing: true,
    markdown: `## Issue Assist

**What it does.** Buttons on an issue page (Summarize, Rewrite, Suggest next
steps, Suggest labels) send the current issue to a model and surface its
proposal. Nothing is applied until you click *Apply*.

**Model.** Claude Sonnet 4.7 (Anthropic) by default.

**Data sent.** Issue title, description, current labels, and the most recent
comments (truncated to fit context).

**Retention.** Same 90-day audit-log policy as Draft.

**Human oversight.** Apply is always explicit. No silent edits.
`,
  },
  {
    id: 'triage',
    name: 'Backlog Triage',
    summary: 'Suggests priorities, labels, and assignees for stale or unassigned issues.',
    purpose:
      'Surface batch triage suggestions for the inbox/backlog so a human triager can sweep large lists quickly.',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    dataSent: [
      'Backlog issue titles + descriptions (batched)',
      'Workspace label taxonomy',
      'Workspace member display names (for assignee suggestions)',
    ],
    dataNotSent: ['Email addresses', 'Sensitive custom field values flagged as private'],
    retention:
      'Run logs (input batch + output diff) retained for 90 days, then purged.',
    defaultOversight: 'review_required',
    userFacing: true,
    markdown: `## Backlog Triage

**What it does.** A scheduled or on-demand run inspects unassigned / stale
issues and proposes priorities, labels, and assignees as **suggestions** in
the triage panel. When workspace oversight is *Review required* (default),
nothing is applied without a human click.

**Auto mode.** Workspace admins can switch oversight to *Auto* per feature.
When Auto is active, low-confidence suggestions still queue for review;
high-confidence ones can be applied automatically. This switch is logged.

**Data sent.** Issue titles, descriptions, the workspace label taxonomy, and
member display names.
`,
  },
  {
    id: 'ask',
    name: 'Ask (Sidecar)',
    summary: 'Conversational Q&A scoped to the entity (issue, project, page) you have open.',
    purpose:
      'Answer questions about the entity currently in view. Read-only; never writes back without an explicit Build action.',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    dataSent: [
      'The entity in view (title, description, recent comments)',
      'Your question',
    ],
    dataNotSent: ['Workspace-wide data', 'Other projects you have access to'],
    retention:
      'Conversation history is per-session in memory and discarded on close. Full prompts/responses are retained 30 days in the audit log.',
    defaultOversight: 'auto',
    userFacing: true,
    markdown: `## Ask (Sidecar)

**What it does.** The right-hand sidecar lets you ask questions about whatever
you have open. It is read-only — the model cannot modify your data in Ask
mode. Switching to Build mode requires an explicit click and falls under the
Draft feature's human-oversight rules.

**Model.** Claude Sonnet 4.7 (Anthropic).

**Retention.** Session memory is in-process and cleared on tab close.
Prompts + responses are kept in the audit log for 30 days.
`,
  },
  {
    id: 'summary',
    name: 'Summary Generation',
    summary: 'Produces summaries of long threads, sprints, and documents on demand.',
    purpose:
      'Save reading time by summarising long bodies of TaskNebula content into a few sentences a human can scan.',
    defaultModel: 'Claude Sonnet 4.7',
    defaultProvider: 'anthropic',
    dataSent: [
      'The content being summarised (issue thread / sprint / doc)',
    ],
    dataNotSent: ['Anything outside the scope of the entity being summarised'],
    retention:
      'Inputs and outputs are retained for 30 days in the audit log, then purged.',
    defaultOversight: 'auto',
    userFacing: true,
    markdown: `## Summary Generation

**What it does.** A *Summarize* button on long threads, sprint reports, and
documents condenses them into 3–5 sentences. The output is clearly marked
*Generated with AI* and never replaces the source material.

**Model.** Claude Sonnet 4.7 (Anthropic).
`,
  },
  {
    id: 'embedding',
    name: 'Semantic Search Embeddings',
    summary: 'Vector embeddings of issues and docs to power semantic search.',
    purpose:
      'Improve relevance of in-app search by allowing the system to retrieve items by meaning rather than exact keyword match.',
    defaultModel: 'text-embedding-3-small',
    defaultProvider: 'openai',
    dataSent: [
      'Issue / document title + description (truncated)',
    ],
    dataNotSent: [
      'Member PII',
      'Private custom field values',
      'Attachment contents',
    ],
    retention:
      'Vectors are stored alongside the source row for the lifetime of that row. Deleting an issue/doc immediately deletes its vector.',
    defaultOversight: 'auto',
    userFacing: false,
    markdown: `## Semantic Search Embeddings

**What it does.** When you create or edit an issue or document, TaskNebula
computes a vector embedding so search can match by meaning. The vector is
opaque numerical data — it cannot reconstruct the original text and is never
shown to other users.

**Model.** OpenAI \`text-embedding-3-small\` by default.

**Retention.** Vector lives as long as the underlying row. Deleting the
issue/doc removes the vector synchronously.

**This feature is not user-facing.** It powers search results; nothing in
the UI is produced by it directly. No AiBadge appears on search results.
`,
  },
] as const;

export function getAiFeatureCard(id: AiFeatureId): AiFeatureModelCard | undefined {
  return AI_FEATURE_MODEL_CARDS.find((c) => c.id === id);
}

/** Subset of cards whose outputs are user-facing — these require AiBadge. */
export const USER_FACING_AI_FEATURES: readonly AiFeatureModelCard[] =
  AI_FEATURE_MODEL_CARDS.filter((c) => c.userFacing);
