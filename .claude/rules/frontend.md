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
- **i18n**: user-facing strings go through `next-intl`; routes are under `[locale]/`.
- **Types**: no new `any`; avoid introducing `exactOptionalPropertyTypes` violations.
