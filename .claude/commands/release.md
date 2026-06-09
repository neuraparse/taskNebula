---
description: Cut a TaskNebula release — bump version, update changelog, verify, then build & push the Docker image
argument-hint: '<new-version e.g. 0.3.4>'
allowed-tools: Read, Edit, Grep, Glob, Bash(pnpm openapi:gen:*), Bash(pnpm type-check:*), Bash(pnpm lint:*), Bash(pnpm test:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git pull:*), Bash(git push:*), Bash(git tag:*), Bash(gh release create:*), Bash(docker build:*), Bash(docker tag:*), Bash(docker push:*), Bash(docker compose build:*), Bash(docker buildx imagetools inspect:*)
---

Cut release **v$ARGUMENTS** following `docs/RELEASE.md`. Read that runbook first, then execute it.

Target version: `$1`

Do this:

1. Confirm the working tree is clean and you're on `main` (this repo releases from `main` directly). Run `git pull --rebase`.
2. Bump the version (`$1`) in: `package.json`, `apps/web/package.json`, `docker-compose.desktop.yml`, and the `0.3.x` references in `README.md`. Run `pnpm openapi:gen`.
3. Update `CHANGELOG.md`: move `[Unreleased]` items into a new `## [$1] - <today>` section and leave a fresh empty `[Unreleased]`.
4. Verify: `pnpm type-check && pnpm lint && pnpm test`. Stop and report if anything fails.
5. Commit `chore(release): v$1` (author Neura Parse), `git push origin main`, then tag `v$1` and `git push origin v$1`.
6. **Pause** and ask the user to confirm before publishing artifacts. Only after they confirm: build & `docker push neuraparse/tasknebula:$1` + `:latest`, then `gh release create v$1`.

Never run `docker push` before the user confirms. Double-check the diff has no secrets before committing (open-source repo).
