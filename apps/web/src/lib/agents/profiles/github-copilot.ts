import { ExecutorProfile } from './claude';

export const githubCopilotProfiles: ExecutorProfile[] = [
  {
    executor: 'GITHUB_COPILOT',
    variant: 'WORKSPACE',
    displayName: 'GitHub Copilot Workspace',
    description: 'GitHub Copilot Workspace - Native GitHub integration with PR workflow',
    baseCommand: 'gh',
    extraParams: ['copilot', 'workspace', 'run'],
    envVars: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      GH_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  },
];

// Note: GitHub Copilot Workspace requires GitHub App installation
// Users must authenticate via: gh auth login
// And install Copilot Workspace: gh extension install github/gh-copilot
