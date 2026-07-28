---
paths:
  - '**/*'
---

# Open-source repository and deployment hygiene

- Treat the tracked repository as public. Never commit an operator's domain,
  public IP, private port map, container inventory, certificate path, secret,
  database dump, or production topology.
- Runtime identity belongs in environment variables such as `APP_URL`.
  Production values stay in ignored `.env` files, compose overrides, and host
  reverse-proxy configuration. Examples and tracked templates use neutral
  placeholder domains only.
- Put browser screenshots and visual-review evidence in `/tmp` or
  `.ui-audit/`. Keep curated product assets only when they are intentionally
  referenced by the application or canonical documentation.
- Do not add chat transcripts, handoff notes, generated reports, or speculative
  planning Markdown. Update the nearest canonical `README.md`, `CLAUDE.md`,
  `DESIGN.md`, or an indexed `docs/` guide when durable guidance is required.
  Local notes use an ignored `.local.md`, `.scratch.md`, or `.handoff.md`
  suffix.
- The root `mobile/` directory is an intentionally untracked, local-only
  workspace. Never add or force-add it, stage/commit/push its contents, copy its
  source into tracked artifacts, or list it in public workspace manifests,
  lockfiles, CI, or release steps. Only work inside it when the user explicitly
  requests local mobile work.
- The production Docker context contains only runtime/build inputs. Exclude
  mobile sources, tests, audit captures, documentation, dumps, and local
  artifacts unless the image demonstrably requires them.
- Treat Git and registry publication as separate, permission-gated actions.
  Never push commits or tags, create a hosted release, publish a Docker image,
  or move a shared tag such as `latest` without the user's explicit approval
  for that destination in the current task. A local build or deployment is not
  publication approval.
- Run `pnpm hygiene:check` before committing or deploying.
