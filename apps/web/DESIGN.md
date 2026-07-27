# TaskNebula Product Design

This document records product intent and the review loop for TaskNebula's web
interface. `DESIGN_SYSTEM.md` remains the token and component contract; this
file explains how those pieces compose into pages and how the result is proven.

## Product intent

TaskNebula is a calm, dense workspace for engineers, product teams, and
operators who spend hours in the product. It should feel fast, architectural,
and trustworthy:

- The work is visually louder than the navigation around it.
- Typography and spacing create hierarchy before color, borders, or shadows.
- One blue primary accent communicates action. Semantic colors communicate
  state; they are not decoration.
- Screens are compact enough for power users without turning into a wall of
  equal-weight controls.
- AI is an accountable collaborator in the workflow, not a visual theme.

The interface must not resemble a generic generated dashboard. Avoid equal
grids of interchangeable cards, gradient headings, ornamental icon tiles,
oversized radii, excessive badges, fake precision, and copy that merely
restates a heading.

## Audience and decisions

The default user is an operator on a desktop or laptop asking a 60-second
question: **what needs action now?**

Secondary users are:

- Leads checking whether a project is on track.
- Analysts explaining why flow or delivery changed.
- Administrators configuring a workspace safely.
- Contributors using a public intake, trust, shared document, or auth flow.

Pages should make the primary decision obvious before presenting supporting
metadata.

## Page archetypes

Every route should fit one archetype. New routes must select an archetype before
markup is written.

### Command

Examples: My Issues, Inbox, Backlog, Board, Drafts.

- The queue, board, or table is the dominant surface.
- Filters and bulk actions stay compact and close to the data they affect.
- Rows are keyboard reachable and preserve context on hover or focus.
- Summary metrics, when useful, occupy one compact strip rather than a bento
  grid.

### Overview

Examples: Dashboard, Projects, Project home, Sprint overview.

- One hero answer or next action wins the squint test.
- Supporting metrics are visibly subordinate.
- At least three content types may appear above the fold, but they must not all
  have equal weight.
- Comparisons are plain secondary text; status is a dot or concise label.

### Analysis

Examples: Project analytics, Roadmap.

- The time range or comparison scope is explicit.
- Charts use the simplest correct encoding and direct labels where practical.
- Numerals use tabular figures and precision matches the decision.
- Loading skeletons preserve the geometry of the eventual chart or table.

### Detail

Examples: Issue detail, Initiative detail, Sprint detail, Project docs.

- Identity and current state precede secondary metadata.
- The primary action remains stable across view states.
- Related information is grouped by proximity, not nested cards.
- Long-form content keeps a readable line length.

### Configuration

Examples: Organization, Members, Integrations, Notifications, Project settings.

- One setting group answers one question.
- Tabs switch sibling views and mirror the URL; unrelated destinations use
  navigation.
- Explanatory copy is short and appears beside the decision it informs.
- Save, destructive, success, and permission states are explicit.

### Public evidence

Examples: Trust Center, AI Model Cards, shared documents, public intake.

- Editorial reading rhythm takes precedence over app density.
- A compact public header makes ownership and escape routes obvious.
- Claims are specific and attributable; compliance and AI disclosures use real
  state rather than marketing language.
- Tables become stacked key/value rows on narrow screens.

### Auth and setup

Examples: Sign in, sign up, password recovery, first-run setup.

- The form remains 360–400px wide and the submit action wins the squint test.
- The supporting panel shows one honest product proof, not decorative artwork.
- Errors appear with the affected operation and a next step.
- The complete flow survives at 320px without horizontal scrolling.

## Composition contract

For each viewport, name these four levels before polishing:

1. **Primary** — the decision, queue, content, or action the page exists for.
2. **Secondary** — context required to act on the primary.
3. **Tertiary** — navigation, filters, and supporting metadata.
4. **Quaternary** — timestamps, identifiers, and low-frequency controls.

Adjacent levels must differ clearly in size, weight, contrast, surface area, or
position. A page with two competing primary elements is unfinished.

Use these structural defaults:

- App content padding: 16px at dense/mobile widths, 20–24px on desktop.
- App headers: compact, border-light, and aligned with their content column.
- List/table rows: 40–48px unless the content genuinely needs more.
- Section spacing must be larger than spacing within the section.
- Empty states contain one explanation and at most one primary action.
- Icons come from Lucide, share a consistent size in a row, and are removed when
  the label already carries the meaning.

## Anti-slop acceptance bar

A product surface is ready only when all applicable checks pass:

- The squint test produces one focal point.
- A single primary accent has at most five prominent placements in the initial
  viewport.
- There is no equal-weight grid of generic feature/stat cards.
- Structure is readable with fewer, softer separators.
- Navigation is quieter than content.
- Generic cards use `rounded-lg`; controls use `rounded-md`; pills and status
  chips use `rounded-sm` or a true circular treatment.
- Decorative gradients do not appear in authenticated product UI.
- Every visible control completes a real action or navigates to a real route;
  logging a click, simulating success, or linking to an unpublished target does
  not count as an implementation.
- Every numeric comparison uses `tabular-nums`.
- Idle, loading, empty, error, and permission-denied states are intentional;
  conflict/offline/success states are added where the interaction can produce
  them.
- Focus order is logical, focus is visible, and motion remains useful with
  `prefers-reduced-motion`.
- Mobile behavior is checked at 320px and 390px, not inferred from desktop.
- Dark and light modes both use the semantic token system.

## Design graph

Changes should flow through the smallest shared node that owns the decision:

```text
DESIGN.md (intent)
  -> DESIGN_SYSTEM.md (tokens and primitives)
    -> src/components/ui (reusable mechanics)
      -> layout and domain components (page patterns)
        -> route pages (content and data)
          -> loading / empty / error / offline states
```

Do not patch dozens of route leaves when a shared primitive is the actual
owner. Do not push a one-off page preference into a global primitive.

## Engineering loop

The design loop is evidence-driven and converges one high-impact problem at a
time:

1. Inventory the route and its states.
2. Capture desktop and mobile screenshots in light and dark mode.
3. Name the hierarchy and the user decision.
4. Fix the highest-impact hierarchy or composition issue.
5. Re-run the full acceptance bar from the first check.
6. Run the executable quality gates.
7. Drive the route with keyboard and pointer input.
8. Compare screenshots and record any accepted minor issue.

Use a maker/checker split for broad work: the implementing agent must not be
the only reviewer of its screenshots or acceptance-bar result.

## Executable harness

Run from the repository root:

```bash
pnpm ui:check
node scripts/i18n-check.mjs
pnpm --filter @tasknebula/web type-check
pnpm --filter @tasknebula/web lint
pnpm --filter @tasknebula/web test
```

`pnpm ui:check` enforces deterministic taste invariants that are safe to check
statically. Browser review remains mandatory because hierarchy, rhythm, and
responsive behavior cannot be proven by source scanning alone.

## Research basis

- Linear,
  [“A calmer interface for a product in motion”](https://linear.app/now/behind-the-latest-design-refresh)
  (2026): recede navigation, reduce icon treatments, and let softened structure
  support the work.
- Notion,
  [“Updating the design of Notion pages”](https://www.notion.com/blog/updating-the-design-of-notion-pages)
  (2026): spacing responds to neighboring content so lists cluster while prose
  breathes.
- Raycast,
  [“A technical deep dive into the new Raycast”](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast)
  (2026): polish is behavior as much as styling; flicker, clipping, keyboard
  behavior, and platform conventions are product quality.
- Vercel, [Web Interface Guidelines](https://vercel.com/design/guidelines):
  interaction, accessibility, focus, content, and performance form one finish
  bar.
- OpenAI,
  [“Harness engineering”](https://openai.com/index/harness-engineering/)
  (2026): repository-local intent, custom linters, browser legibility, and
  recurring garbage collection turn taste into a compounding system.
- Google Labs,
  [“Introducing DESIGN.md”](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/)
  (2026): explicit visual intent makes implementation constraints portable
  across tools and sessions.
- [`educlopez/ui-craft`](https://github.com/educlopez/ui-craft): measurable
  anti-slop and finish-bar checks informed the static gate and visual acceptance
  bar above.
