---
description: Commit current work and push directly to main (the maintainer's preferred flow)
argument-hint: '[optional commit message / context]'
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(git add:*), Bash(git commit:*), Bash(git pull:*), Bash(git push:*)
---

Ship the current work straight to `main`. Context for the commit message: $ARGUMENTS

Steps:

1. Run `git status` and `git diff` to see what's staged/unstaged. Summarize what changed.
2. Confirm you are on `main` (this repo pushes directly to main — no branch/PR). Run `git pull --rebase` first to avoid non-fast-forward rejections.
3. Verify before pushing: `pnpm type-check && pnpm lint && pnpm test` (or `/verify`). If anything fails, stop and report — do not push.
4. Stage the relevant files and commit with a Conventional Commit message (`type(scope): subject`, ≤120 chars) derived from $ARGUMENTS. Author is Neura Parse `<hello@neuraparse.com>`.
5. Push with `git push origin main`.
6. Report the pushed commit hash.

This repo is **open-source** — double-check the diff contains no secrets/`.env`/keys before committing. If there are no changes to commit, say so and stop.
