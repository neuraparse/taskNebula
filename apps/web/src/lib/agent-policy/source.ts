import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createAgentPolicyDocument } from './parser';
import type { AgentPolicyDocument } from './types';

export const AGENT_POLICY_DISCOVERY_PATHS = [
  '.tasknebula/AGENTOWNERS',
  '.github/AGENTOWNERS',
  'AGENTOWNERS',
] as const;

function resolvePolicyRoots() {
  const configuredRoot = process.env.TASKNEBULA_POLICY_ROOT || process.env.AGENTOWNERS_ROOT;
  if (configuredRoot) return [path.resolve(configuredRoot)];

  const cwd = path.resolve(process.cwd());
  return Array.from(new Set([cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')]));
}

function isInsideRoot(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function discoverAgentPolicy(): Promise<AgentPolicyDocument> {
  const roots = resolvePolicyRoots();

  for (const root of roots) {
    for (const relativePath of AGENT_POLICY_DISCOVERY_PATHS) {
      const candidate = path.resolve(root, relativePath);
      if (!isInsideRoot(root, candidate)) continue;

      try {
        const content = await readFile(candidate, 'utf8');
        return createAgentPolicyDocument({
          found: true,
          sourcePath: candidate,
          content,
        });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') continue;
        return {
          found: true,
          sourcePath: candidate,
          content: null,
          rules: [],
          errors: [
            {
              line: 0,
              message: `Failed to read policy file: ${code || 'unknown_error'}`,
              raw: '',
            },
          ],
          parsedAt: new Date().toISOString(),
        };
      }
    }
  }

  return createAgentPolicyDocument({
    found: false,
    sourcePath: null,
    content: null,
  });
}
