---
paths:
  - 'apps/web/src/**/*.tsx'
  - 'apps/web/src/**/*.ts'
  - 'apps/web/src/**/*.css'
---

# Frontend rules (apps/web)

- **Framework**: Next.js 15 App Router + React 19. Prefer Server Components; add `"use client"` only when you need interactivity/hooks.
- **Imports**: use path aliases `@/*`, `@/components/*`, `@/lib/*`, `@/app/*` — not long relative chains.
- **State**: TanStack Query for server state, Zustand for UI state, React Hook Form + Zod for forms. Don't fetch in `useEffect` when Query fits.
- **UI primitives**: build on `src/components/ui/` (shadcn/Radix) + `class-variance-authority`. Reuse before creating new primitives.
- **Design system** (`apps/web/DESIGN_SYSTEM.md`): radii `rounded-sm`(2px)/`rounded-md`(4px)/`rounded-lg`(6px); semantic `accent-*` colors and `text-muted-foreground`; spring motion 150–200ms; must work in dark mode. Avoid arbitrary hex/colors when a token exists.
- **i18n (MANDATORY — zero hardcoded strings)**: EVERY user-facing string MUST go through `next-intl`. This includes JSX text **and** string props (`placeholder`, `aria-label`, `title`, `alt`, `label`, `description`, `tooltip`, `confirmText`, …), `toast`/sonner messages, and user-facing error messages. Never hardcode display text in a component or page. Add the English key to `apps/web/messages/en.json` under the right namespace, then use `useTranslations('ns')` (client) or `await getTranslations('ns')` (async server). **Every new key must be added to ALL 30 locale catalogs** in `apps/web/messages/*.json` — keep full key parity (`node scripts/i18n-check.mjs`). The app ships 30 languages with device/browser auto-detection (`Accept-Language`) + cookie persistence; the switcher lists all locales by native name; `ar`/`he` are RTL. The **only** English-only surface is the marketing landing (`components/marketing/*`). Lint (`react/jsx-no-literals`) rejects new hardcoded JSX text.
- **Types**: no new `any`; avoid introducing `exactOptionalPropertyTypes` violations.
