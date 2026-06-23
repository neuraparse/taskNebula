# Release & Publishing Runbook

How to cut a TaskNebula release and publish the Docker image. SemVer; the
source of truth for the version is the root `package.json` `version`.

> Prerequisites: working tree clean, on `main` (or a release branch), `docker
login` as the **`neuraparse`** Docker Hub account, and `pnpm install` run.

## 1. Pick the version

Decide the next SemVer number (`MAJOR.MINOR.PATCH`). The examples below use
`<v>` — replace it everywhere (e.g. `0.3.4`).

## 2. Bump version references

Update the version in every pinned location:

- `package.json` → `"version"`
- `apps/web/package.json` → `"version"`
- `docker-compose.desktop.yml` → `neuraparse/tasknebula:<v>`
- `README.md` → the `0.3.x` references (recommended-tag table, pin examples)
- Regenerate the API spec so the version matches:
  ```bash
  pnpm --filter @tasknebula/web openapi:gen   # writes apps/web/public/openapi.json
  ```
  (Plain `pnpm openapi:gen` at the repo root fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` —
  the script only exists in the `@tasknebula/web` workspace.)

> `docker-compose.yml` (production) keeps the web service at `:latest` and is
> pinned at deploy time via `TASKNEBULA_IMAGE=neuraparse/tasknebula:<v>`, so it
> does not need editing.

## 3. Update the changelog

In `CHANGELOG.md`, move items from `[Unreleased]` into a new
`## [<v>] - YYYY-MM-DD` section (Keep a Changelog: `Added` / `Changed` /
`Fixed` / `Security`, etc.). Leave a fresh empty `[Unreleased]` heading.

## 4. Verify locally

```bash
pnpm type-check && pnpm lint && pnpm test     # or: /verify
```

## 5. Commit, tag, push

Releases go straight to `main` (no PR for the maintainer's own work):

```bash
git pull --rebase
git add -A
git commit -m "chore(release): v<v>"   # author: Neura Parse <hello@neuraparse.com>
git push origin main
git tag -a v<v> -m "TaskNebula v<v>"
git push origin v<v>
```

## 6. Build & push the Docker image

Image: `neuraparse/tasknebula` on Docker Hub, platform `linux/amd64`.

```bash
# Build the web image (uses the multi-stage Dockerfile, standalone output)
docker build \
  -t neuraparse/tasknebula:<v> \
  -t neuraparse/tasknebula:latest \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  .
# (equivalently: docker compose build web)

# Push both tags
docker push neuraparse/tasknebula:<v>
docker push neuraparse/tasknebula:latest
```

Confirm the published digest:

```bash
docker buildx imagetools inspect neuraparse/tasknebula:<v>
```

## 7. Publish release notes

Create the GitHub release from the tag (notes can come from the changelog):

```bash
gh release create v<v> --title "v<v>" --notes-file <(sed -n '/## \[<v>\]/,/## \[/p' CHANGELOG.md)
```

## Rollback

Operators pin a known-good tag without a rebuild:

```bash
./scripts/tasknebula-backup.sh
TASKNEBULA_IMAGE=neuraparse/tasknebula:<previous> docker compose up -d
```

## Notes

- The runtime image runs DB migrations on start (`docker-entrypoint.sh`) and
  serves on port `3000` with health at `GET /api/health`.
- `scripts/tasknebula-backup.sh` writes a Postgres custom-format archive,
  uploads archive, manifest, and checksums before manual update or rollback
  work. Restore the database with `pg_restore` and restore `uploads.tar.gz` to
  the uploads volume before starting the target web image.
- There is no CI publish pipeline yet — releases are cut manually with this
  runbook. If/when a GitHub Actions workflow is added, it should mirror these
  steps.
