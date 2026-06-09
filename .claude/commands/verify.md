---
description: Run the full local verification gate — type-check, lint, and tests
allowed-tools: Bash(pnpm type-check:*), Bash(pnpm lint:*), Bash(pnpm test:*)
---

Run the TaskNebula verification gate from the repo root and report results.

1. `pnpm type-check`
2. `pnpm lint`
3. `pnpm test`

Run all three even if an earlier one fails (so the user sees every failure at once). Then summarize: which passed, which failed, and for each failure the key error with `file:line`. If everything passes, say so in one line. Do not attempt fixes unless asked.
