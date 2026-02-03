export interface ExecutorProfile {
  executor: string;
  variant: string;
  displayName: string;
  description: string;
  baseCommand: string;
  extraParams: string[];
  envVars: Record<string, string>;
  mcpConfig?: Record<string, any>;
}

export const claudeProfiles: ExecutorProfile[] = [
  {
    executor: 'CLAUDE_CODE',
    variant: 'SONNET',
    displayName: 'Claude Code (Sonnet 4)',
    description: 'Claude Sonnet 4 - Balanced speed and intelligence for most coding tasks',
    baseCommand: 'npx',
    extraParams: ['-y', '@anthropic-ai/claude-code@latest', '--model', 'claude-sonnet-4-20250514'],
    envVars: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    },
  },
  {
    executor: 'CLAUDE_CODE',
    variant: 'OPUS',
    displayName: 'Claude Code (Opus)',
    description: 'Claude Opus - Most capable for complex refactoring and architecture',
    baseCommand: 'npx',
    extraParams: ['-y', '@anthropic-ai/claude-code@latest', '--model', 'claude-opus-4-20250514'],
    envVars: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    },
  },
  {
    executor: 'CLAUDE_CODE',
    variant: 'HAIKU',
    displayName: 'Claude Code (Haiku)',
    description: 'Claude Haiku - Fastest for simple tasks and quick fixes',
    baseCommand: 'npx',
    extraParams: ['-y', '@anthropic-ai/claude-code@latest', '--model', 'claude-haiku-3-20250219'],
    envVars: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    },
  },
];
