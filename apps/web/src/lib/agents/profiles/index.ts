// Export all agent profiles without importing heavy dependencies (dockerode, etc.)
export { claudeProfiles, type ExecutorProfile } from './claude';
export { openaiProfiles } from './openai';
export { githubCopilotProfiles } from './github-copilot';

export function getAllProfiles() {
  const { claudeProfiles } = require('./claude');
  const { openaiProfiles } = require('./openai');
  const { githubCopilotProfiles } = require('./github-copilot');

  return [
    ...claudeProfiles,
    ...openaiProfiles,
    ...githubCopilotProfiles,
  ];
}
