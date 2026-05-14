#!/usr/bin/env node
/**
 * cron-agents.mjs — trigger the standup or janitor cron endpoint.
 *
 * Usage:
 *   CRON_SECRET=... node scripts/cron-agents.mjs standup
 *   CRON_SECRET=... node scripts/cron-agents.mjs janitor --org=ORG_ID --dry-run
 *
 * Designed to be invoked by an external scheduler (cron, systemd timer,
 * GitHub Actions, etc). For a docker-compose deployment a sidecar
 * container is wired up in docker-compose.yml — this script is a
 * convenience for ops folks running outside compose.
 */

const argv = process.argv.slice(2);
const [target, ...rest] = argv;

if (!target || !['standup', 'janitor'].includes(target)) {
  console.error('Usage: node scripts/cron-agents.mjs <standup|janitor> [--org=ID] [--dry-run]');
  process.exit(64);
}

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET env var is required');
  process.exit(1);
}

const baseUrl =
  process.env.WEB_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

const body = {};
for (const flag of rest) {
  if (flag.startsWith('--org=')) body.organizationId = flag.slice('--org='.length);
  if (flag === '--dry-run') body.dryRun = true;
}

const url = `${baseUrl.replace(/\/$/, '')}/api/cron/${target}`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': secret,
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`HTTP ${res.status} from ${url}`);
  console.error(await res.text());
  process.exit(2);
}

const out = await res.json();
console.log(JSON.stringify(out, null, 2));
