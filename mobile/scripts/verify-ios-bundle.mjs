#!/usr/bin/env node
/**
 * iOS bundle guard for the bare, self-hosted mobile app.
 *
 * Linux CI cannot build the native iOS target, but it can still prove that the
 * React Native iOS release JS bundle and assets are packageable without Expo.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let tempDir;

function commandEnv() {
  const env = { ...process.env };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return env;
}

function fail(message) {
  console.error(`iOS bundle verification failed: ${message}`);
  process.exit(1);
}

function run(label, command, args) {
  console.log(`\n[ios-bundle] ${label}`);
  const result = spawnSync(command, args, {
    cwd: mobileRoot,
    encoding: 'utf8',
    env: commandEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    fail(`${command} could not start: ${result.error.message}`);
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    if (output.trim()) console.error(output);
    fail(`${label} exited with status ${result.status}.`);
  }
  if (output.trim()) {
    const lines = output.trim().split(/\r?\n/);
    console.log(lines.slice(-20).join('\n'));
  }
}

function assertFile(label, filePath, minBytes) {
  if (!fs.existsSync(filePath)) fail(`${label} was not created at ${filePath}.`);
  const size = fs.statSync(filePath).size;
  if (size < minBytes) fail(`${label} is unexpectedly small (${size} bytes).`);
  console.log(`[ios-bundle] ${label}: ${filePath} (${size} bytes)`);
}

function countFiles(directory) {
  if (!fs.existsSync(directory)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) count += countFiles(entryPath);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

try {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasknebula-ios-bundle-'));
  const bundleOutput = path.join(tempDir, 'main.jsbundle');
  const assetsDest = path.join(tempDir, 'assets');

  run('create release JS bundle', 'pnpm', [
    'exec',
    'react-native',
    'bundle',
    '--platform',
    'ios',
    '--dev',
    'false',
    '--entry-file',
    'index.js',
    '--bundle-output',
    bundleOutput,
    '--assets-dest',
    assetsDest,
    '--reset-cache',
  ]);

  assertFile('iOS release JS bundle', bundleOutput, 1024 * 1024);
  const assetCount = countFiles(assetsDest);
  if (assetCount === 0) fail(`no iOS bundle assets were copied to ${assetsDest}.`);
  console.log(`[ios-bundle] copied assets: ${assetCount}`);
  console.log('\niOS bundle verification passed.');
} finally {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
}
