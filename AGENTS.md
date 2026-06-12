# Agent Instructions

The canonical guide for AI agents and assistants working in this repository
is **[CLAUDE.md](CLAUDE.md)** — it is the single source of truth for the
tech stack, build/test commands, project conventions, the git & release
workflow, and architecture.

Tools that follow the `AGENTS.md` convention should read `CLAUDE.md` as the
full instruction set.

Per-package guides (each `CLAUDE.md` has a sibling `AGENTS.md` pointer):

- [apps/web/CLAUDE.md](apps/web/CLAUDE.md) — Next.js app: route auth idiom, validation, i18n, design system
- [packages/db/CLAUDE.md](packages/db/CLAUDE.md) — Drizzle schema & hand-written migration conventions
- [packages/mcp-server/CLAUDE.md](packages/mcp-server/CLAUDE.md) — MCP server tools, auth caveats
- [services/hocuspocus/CLAUDE.md](services/hocuspocus/CLAUDE.md) — Yjs realtime collab server

@CLAUDE.md
