/**
 * MCP prompt templates for TaskNebula.
 *
 * Prompts are short, parameterized chat templates that the model can
 * invoke to bootstrap a common workflow.
 */
import { z } from 'zod';

export interface PromptDefinition<Args extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  argsSchema: Args;
  build: (args: z.infer<Args>) => Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
}

const triageInbox: PromptDefinition = {
  name: 'triage_inbox',
  description:
    'Walk through unassigned + unprioritized issues and propose triage actions (assignee, priority, labels).',
  argsSchema: z.object({
    projectId: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  build(args: { projectId?: string; limit?: number }) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            `You are a triage assistant for TaskNebula.\n\n` +
            `1. Call \`search_issues\` with status="open" and assigneeId omitted` +
            (args.projectId ? `, projectId="${args.projectId}"` : '') +
            `, limit=${args.limit ?? 20}.\n` +
            `2. For each issue propose:\n` +
            `   - a sensible priority\n` +
            `   - a likely assignee (use \`list_projects\` + project members)\n` +
            `   - 1-3 labels\n` +
            `3. Present the proposals as a table and ask for confirmation before applying any updates.`,
        },
      },
    ];
  },
};

const standupSummary: PromptDefinition = {
  name: 'standup_summary',
  description: 'Generate a daily-standup summary for the authenticated user.',
  argsSchema: z.object({
    window: z.enum(['yesterday', 'today', 'this_week']).default('today'),
  }),
  build(args: { window?: 'yesterday' | 'today' | 'this_week' }) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            `Generate a concise standup summary using TaskNebula data.\n` +
            `Window: ${args.window ?? 'today'}.\n\n` +
            `Use \`list_my_assigned\` and \`get_my_workload\`. Output three bullet sections: ` +
            `"Done", "In Progress", "Blockers".`,
        },
      },
    ];
  },
};

const sprintPlanning: PromptDefinition = {
  name: 'sprint_planning',
  description: 'Draft a sprint plan from a project backlog and team capacity.',
  argsSchema: z.object({
    projectId: z.string(),
    sprintLengthDays: z.number().int().min(1).max(28).default(14),
    capacityHours: z.number().int().min(1).default(80),
  }),
  build(args: { projectId: string; sprintLengthDays?: number; capacityHours?: number }) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            `Plan a ${args.sprintLengthDays ?? 14}-day sprint for project ${args.projectId} with ` +
            `${args.capacityHours ?? 80} hours of team capacity.\n\n` +
            `Steps:\n` +
            `1. Read \`tasknebula://project/${args.projectId}\` for context.\n` +
            `2. Call \`search_issues\` with projectId="${args.projectId}", status="backlog".\n` +
            `3. Group by epic, sort by priority, fit within capacity using estimates.\n` +
            `4. Return a draft sprint with rationale and ask for sign-off before assigning.`,
        },
      },
    ];
  },
};

export const allPrompts: PromptDefinition[] = [triageInbox, standupSummary, sprintPlanning];
