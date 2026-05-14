# i18n migration plan (FEAT-34)

This doc tracks what is **already i18n-ready** in TaskNebula and what still
needs follow-up. FEAT-34 shipped the scaffolding: locales, message
catalogs, `next-intl` runtime, the `[locale]` segment, the language
switcher, RTL infrastructure, and a first wave of migrated strings on the
highest-traffic surfaces.

## What's wired today

- **Locales:** `en` (default), `tr`, `de`, `es`. See
  `apps/web/src/lib/i18n/config.ts`.
- **Message catalogs:** `apps/web/messages/{en,tr,de,es}.json` with the
  `nav.*`, `actions.*`, `dashboard.*`, `auth.*`, `common.*` namespaces.
- **Runtime:** `next-intl/plugin` is registered in
  `apps/web/next.config.ts` and points to
  `apps/web/src/lib/i18n/request.ts`. The middleware
  (`apps/web/src/middleware.ts`) wraps `next-intl/middleware` for app
  routes while leaving `/api`, `/auth`, `/share`, `/setup` and `/offline`
  un-localized.
- **App Router segment:** `apps/web/src/app/[locale]/(app)/...`. The
  legacy `(app)` group was moved under `[locale]`. The root
  `apps/web/src/app/page.tsx` (marketing landing) and `app/auth/*`
  routes stay at the top level.
- **HTML `lang` + `dir`:** `apps/web/src/app/layout.tsx` resolves the
  active locale (header → cookie → default) and renders `<html lang>`
  and `<html dir>` accordingly. Radix `DirectionProvider` is wrapped at
  the root.
- **Language switcher:** `apps/web/src/components/layout/language-switcher.tsx`
  is mounted inside `AppHeader`. It writes the `tasknebula-locale`
  cookie and reloads.

## Migrated components

The following components consume `useTranslations()` for their
high-traffic strings:

- `apps/web/src/components/layout/app-sidebar.tsx` — section labels
  (Home, My Issues, Projects, Team, Settings, Admin), the
  My-Issues view list (`assigned_to_me`, `created_by_me`, `subscribed`,
  `mentioned`), the dashboard mini-nav (`overview`, `drafts`,
  `templates`), the team links (`members`, `teamspaces`,
  `pending_invites`), the "Settings" / "Admin" / "Teamspaces" /
  "Projects" / "Live Calls" kickers, the loader, the
  "no projects" empty state, and the "View all {count} projects" link.
- `apps/web/src/components/layout/app-header.tsx` — search trigger
  placeholder, "Help" + "Open command palette" aria-labels, language
  switcher.
- `apps/web/src/app/[locale]/(app)/dashboard/dashboard-client.tsx` —
  greeting kicker, "Live" pill, "Welcome back, {name}", subtitle,
  KPI tile labels, "My Issues" heading, "View all", "You're all caught
  up.", "Create issue", "Create a project first".
- `apps/web/src/components/auth/signin-form.tsx` — title, subtitle,
  email + password labels and placeholders, GitHub/Google buttons, the
  "Or continue with email" divider, "Forgot password?", error
  fallbacks, "Sign in" / "Signing in..." submit copy, "Don't have an
  account? Sign up".

Total: ~45-50 strings, matching the FEAT-34 budget.

## RTL infrastructure

- `lib/i18n/config.ts` exports `isRtlLocale` + `getDirection`. The list
  contains `ar`, `he`, `fa`, `ur` so they will "just work" once the
  catalog lands.
- Radix `DirectionProvider` is wrapped at both `app/layout.tsx` and
  `app/[locale]/layout.tsx`, so Radix primitives (dropdowns, popovers,
  dialogs) flip automatically.
- Tailwind logical-property migrations applied as a starter:
  - `app-header.tsx`: `pl-9 pr-2` → `ps-9 pe-2`, `left-3` → `start-3`,
    `text-left` → `text-start`, `ml-auto` → `ms-auto`.
  - `app-sidebar.tsx`: four `text-left` → `text-start` instances on
    section toggles and the live-call links.
  - `signin-form.tsx`: two `mr-2` → `me-2` on the OAuth icons.

## What still needs migration (TODO)

These have a `TODO(i18n)` comment in code where applicable; the
catalogs already have empty slots reserved or namespaces ready for
expansion.

### Strings (next slice)

| Surface | File | Notes |
|---|---|---|
| Settings nav labels | `components/layout/app-sidebar.tsx` (`SETTINGS_LINKS`) | Add `nav.organization`, `nav.api_keys`, `nav.webhooks`, `nav.integrations`, `nav.ai_agents`, `nav.communications`, `nav.notifications`, `nav.appearance`, `nav.activity` |
| Admin nav labels | `components/layout/app-sidebar.tsx` (`ADMIN_LINKS`) | Add `nav.organizations`, `nav.users`, `nav.feature_flags`, `nav.agent_control`, `nav.realtime_health`, `nav.audit_logs` |
| Signup form | `components/auth/signup-form.tsx` | Mirror the signin-form pattern. |
| Password reset / forgot | `components/auth/*` | Same pattern. |
| Issue detail, create issue, kanban, sprints, projects index, docs index, settings tabs | `components/issues/*`, `components/kanban/*`, `components/sprints/*`, `app/[locale]/(app)/projects/...`, `app/[locale]/(app)/docs/...`, `components/settings/*` | Highest-volume slice; ~300-500 strings. |
| Toasts, command palette items | `lib/command/*`, `hooks/use-toast` consumers | Need a `toasts.*` namespace. |
| Date/time formats | All surfaces that format dates | Use `next-intl`'s `useFormatter()` instead of raw `date-fns`. |

### RTL

- Bulk-migrate remaining `ml-*`, `mr-*`, `pl-*`, `pr-*`,
  `text-left`, `text-right`, `left-*`, `right-*` to logical
  properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`,
  `text-end`, `start-*`, `end-*`). Roughly 600-800 occurrences across
  the app.
- Add an `ar` locale catalog and append `ar` to `locales` in
  `lib/i18n/config.ts`.
- QA visual regressions on dropdowns/popovers/dialogs in RTL.

### Routing

- The legacy `/auth/*` routes were intentionally left un-localized. If
  we want localized signin URLs (`/tr/auth/signin`), they need to be
  moved under `[locale]` and the middleware adjusted.
- The marketing landing at `app/page.tsx` is also un-localized. A
  follow-up could move it under `[locale]` and SEO-aware
  `hreflang` tags.
- `next-intl` `localePrefix: 'as-needed'` is in effect, so existing
  paths like `/dashboard` keep working without an `/en` prefix. Once a
  user switches language via the dropdown, the cookie steers
  `<html lang>` + the catalog without changing the URL. If
  product wants visible `/tr/dashboard` URLs, switch
  `localePrefix` to `'always'` and add redirects.

### Translations

Translations for TR/DE/ES in this drop were produced by the
implementing engineer and **must be reviewed** by a native speaker
before going to production. Acceptable as scaffolding; not acceptable
as released copy.

### Tests

- `components/layout/__tests__/language-switcher.test.tsx` covers the
  basic locale-render contract. Add per-component snapshot tests as
  surfaces migrate.
- A future test should boot the full sidebar in `tr` to catch missing
  keys end-to-end.

## Operational notes

- The `tasknebula-locale` cookie is `SameSite=Lax`, 1 year. It is set
  by `LanguageSwitcher` and read by both the middleware and the root
  layout.
- The Plane parity webhook signing work in PR #13 is independent of
  i18n; no overlap.
- When adding a new namespace, update **all four** catalogs in lock
  step. CI does not yet enforce this — a follow-up task to add a
  `scripts/check-i18n-parity.ts` would help.
