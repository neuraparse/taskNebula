import type { LLMMessage } from './types';

/**
 * Prompt templates for TaskNebula AI features
 */

export const PROMPTS = {
  /**
   * Generate a structured issue from natural language description
   */
  generateIssue: (description: string): LLMMessage[] => [
    {
      role: 'system',
      content: `You are an AI assistant helping to create structured project management issues.
Given a natural language description, extract and structure the following information:
- Title: A clear, concise title (max 100 chars)
- Description: Detailed description with acceptance criteria
- Type: story, task, bug, or epic
- Priority: critical, high, medium, low, or none
- Estimated effort: S (small), M (medium), L (large), or XL (extra large)
- Suggested labels: Array of relevant labels

Return the response as a JSON object with these fields.`,
    },
    {
      role: 'user',
      content: description,
    },
  ],

  /**
   * Summarize a long comment thread
   */
  summarizeThread: (comments: string[]): LLMMessage[] => [
    {
      role: 'system',
      content: `You are an AI assistant helping to summarize discussion threads.
Provide a concise summary of the key points, decisions made, and action items.
Keep the summary under 200 words.`,
    },
    {
      role: 'user',
      content: `Summarize this discussion thread:\n\n${comments.join('\n\n---\n\n')}`,
    },
  ],

  /**
   * Suggest sprint planning based on backlog and team capacity
   */
  suggestSprintPlan: (backlog: string[], capacity: number, velocity: number): LLMMessage[] => [
    {
      role: 'system',
      content: `You are an AI assistant helping with sprint planning.
Given a backlog of issues, team capacity (in story points), and historical velocity,
suggest which issues should be included in the next sprint.

Consider:
- Team capacity and velocity
- Issue priority and dependencies
- Balanced workload
- Risk factors

Return a JSON object with:
- selectedIssues: Array of issue IDs to include
- reasoning: Brief explanation of the selection
- warnings: Any potential risks or concerns`,
    },
    {
      role: 'user',
      content: `Backlog:\n${backlog.join('\n')}\n\nCapacity: ${capacity} points\nHistorical Velocity: ${velocity} points/sprint`,
    },
  ],

  /**
   * Analyze project health and risks
   */
  analyzeProjectHealth: (metrics: {
    openIssues: number;
    blockedIssues: number;
    overdueIssues: number;
    velocity: number[];
    burndownData: number[];
  }): LLMMessage[] => [
    {
      role: 'system',
      content: `You are an AI assistant analyzing project health metrics.
Provide insights on:
- Overall project health (healthy, at-risk, critical)
- Key risks and concerns
- Recommendations for improvement
- Velocity trends

Keep the analysis concise and actionable.`,
    },
    {
      role: 'user',
      content: `Project Metrics:
- Open Issues: ${metrics.openIssues}
- Blocked Issues: ${metrics.blockedIssues}
- Overdue Issues: ${metrics.overdueIssues}
- Recent Velocity: ${metrics.velocity.join(', ')} points
- Burndown: ${metrics.burndownData.join(', ')}`,
    },
  ],

  /**
   * Make issue title clearer and more actionable
   */
  improveTitle: (title: string): LLMMessage[] => [
    {
      role: 'system',
      content: `You are an AI assistant helping to improve issue titles.
Make the title:
- Clear and specific
- Action-oriented (start with a verb when appropriate)
- Concise (under 80 characters)
- Professional

Return only the improved title, nothing else.`,
    },
    {
      role: 'user',
      content: title,
    },
  ],
};

