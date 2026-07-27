#!/usr/bin/env node

/**
 * Reject deployment-private identifiers and ephemeral artifacts before they
 * enter the public repository. The scan includes tracked files and non-ignored
 * untracked files so it is useful before the first commit.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repositoryFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean);

const blockedPathRules = [
  {
    id: 'temporary-directory',
    pattern:
      /(^|\/)(?:tmp|temp|screenshots?|screen-captures|artifacts?|playwright-report|test-results)(?:\/|$)/i,
    message: 'Temporary evidence belongs in /tmp or the ignored .ui-audit directory.',
  },
  {
    id: 'ephemeral-markdown',
    pattern: /\.(?:scratch|handoff|private|local)\.md$/i,
    message: 'Ephemeral Markdown must remain ignored and local.',
  },
  {
    id: 'root-screen-capture',
    pattern: /^(?:screenshot|capture|tmp-).*\.(?:png|jpe?g|webp|gif)$/i,
    message: 'Root-level screen captures are local verification artifacts.',
  },
];

// Keep operator-specific host fragments separate so the private hostname
// itself never appears in tracked source, including this guard.
const privateHostPatterns = [new RegExp(`\\b${['nowflow', 'io'].join('\\.')}\\b`, 'i')];

const findings = [];

for (const path of repositoryFiles) {
  for (const rule of blockedPathRules) {
    if (rule.pattern.test(path)) {
      findings.push(`${path} [${rule.id}] ${rule.message}`);
    }
  }

  let source;
  try {
    source = readFileSync(path);
  } catch {
    continue;
  }

  if (source.includes(0)) continue;
  const text = source.toString('utf8');

  for (const pattern of privateHostPatterns) {
    if (pattern.test(text)) {
      findings.push(
        `${path} [private-deployment-host] Use APP_URL or a neutral example domain instead.`
      );
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`Repository hygiene check failed with ${findings.length} finding(s).\n\n`);
  for (const finding of findings) process.stderr.write(`${finding}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Repository hygiene check passed: ${repositoryFiles.length} public-source candidates are clean.\n`
  );
}
