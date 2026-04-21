# TaskNebula Design System — Agent Contract (v0.2.1 square-sharp refresh)

> **STATUS:** Authoritative reference for refactor agents. Read this before touching any component.
> Do NOT modify `globals.css`, `tailwind.config.ts`, or this file. All agents consume this contract.

## Design Intent — v0.2.1 refresh

**Square-ish, modern, quietly colorful, minimal.** Think Linear × Vercel × Raycast × Arc.
Key change from v0.2.0: radii are now **near-sharp** (2/4/6 px). The UI should read as
precise and architectural — flat planes with soft motion, never candy-ish.

1. **Radii are tight.** Default = 4px. Cards = 6px. Pills = 2px. Never use `rounded-xl/2xl`
   on new markup; keep only for hero surfaces that already use it.
2. **Color appears for meaning, not decoration.** Use `primary` for action intent and the
   `accent-*` family only for semantic categories (live, warning, destructive, data).
3. **Less chrome. More signal.** Consolidate section headers, trim nested cards, reduce
   chevrons/icons. If a row has >4 visual elements, drop the lowest-value.
4. **Motion is soft + snappy.** Use `duration-150` with `ease-snap` for interactives; use
   `animate-blur-in` / `animate-pop-in` / `animate-fade-up` for entrances. Reserve
   `animate-aurora` for hero backgrounds only.
5. **Realtime is visible.** Use `.live-pill` or `.realtime-ping` wrapping a status dot for
   anything that updates in realtime (presence, notifications, websocket state).

### Non-negotiable principles

1. **Less border, more whitespace.** Remove redundant dividers/cards. Let spacing do the separating.
2. **One primary hue per surface.** Don't sprinkle five colors; use `primary` for interactive intent,
   accent-\* only for semantic (status, priority, category).
3. **Typography carries hierarchy.** Weight and size before color. Muted text = `text-muted-foreground`.
4. **Motion is soft.** Spring easings (`ease-smooth`, `ease-bounce-soft`), 200–400ms, never longer.
5. **Dark mode is first-class.** Test both. Warm near-black base, not pure `#000` and not flat gray.
6. **Reduce visual noise.** Prefer one focal element per section. Cut "card-within-card" nesting.

---

## Token Reference (use these — don't hardcode colors)

### Surfaces
| Token | Purpose |
|---|---|
| `bg-background` | Page root |
| `bg-card` | Elevated content (cards, popovers, dropdowns) |
| `bg-surface` | Subtle inset (code blocks, alert blocks) |
| `bg-surface-2` | Deeper inset (nested panels) |
| `bg-muted` | Neutral pill / chip bg |
| `bg-accent` | Hover state neutral |

### Text
| Token | Purpose |
|---|---|
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary / captions |
| `text-primary` | Interactive / brand emphasis |

### Primary + semantic
| Token | Purpose |
|---|---|
| `bg-primary text-primary-foreground` | Main CTA, active nav |
| `bg-primary/10 text-primary` | Soft active state, selected chips |
| `bg-success / bg-warning / bg-destructive / bg-info` | Status buttons |
| `text-success / text-warning / text-destructive / text-info` | Status text |

### Accent palette (semantic hues — use sparingly)
| Token | Meaning hint |
|---|---|
| `text-accent-blue` / `bg-accent-blue/10` | Info, neutral accent |
| `text-accent-violet` / `bg-accent-violet/10` | Workflow, automation |
| `text-accent-cyan` / `bg-accent-cyan/10` | Analytics, data |
| `text-accent-emerald` / `bg-accent-emerald/10` | Success, live status |
| `text-accent-amber` / `bg-accent-amber/10` | Warning, pending |
| `text-accent-rose` / `bg-accent-rose/10` | Critical, destructive |
| `text-accent-indigo` / `bg-accent-indigo/10` | Brand variant |

### Borders
| Token | Purpose |
|---|---|
| `border-border` | Default hairline |
| `border-border-strong` | Emphasized edge |
| `border-primary/20` | Selected / focused surface |
| `ring-2 ring-ring` | Focus ring (keyboard) |

### Shadows
| Token | Use |
|---|---|
| `shadow-xs` | Resting cards |
| `shadow-sm` | Dropdowns, popovers |
| `shadow-md` | Hover lift, modals inline |
| `shadow-lg` | Dialogs, floating panels |
| `shadow-glow` / `shadow-glow-primary` | Brand emphasis (rare) |

### Radius (v0.2.1 — square-ish)
| Token | Pixels | Use |
|---|---|---|
| `rounded-sm` | 2px | Pills, tiny chips, tags |
| `rounded-md` | 4px | Buttons, inputs, menus, dropdowns |
| `rounded-lg` | 6px | Cards, modals, dialogs |
| `rounded-xl` | 10px | Large panels / hero surfaces only |
| `rounded-2xl` | 16px | Reserve for showcase hero only |
| `rounded-full` | — | Avatars, dots, status indicators |

**Rule:** prefer `rounded-md` (4px) as default for anything interactive. Do not add
`rounded-xl`/`rounded-2xl` to new markup unless the element is a hero.

### Gradients (for hero / emphasis only, not everywhere)
- `bg-gradient-primary` (indigo → violet)
- `bg-gradient-accent` (emerald → cyan)
- `bg-gradient-warm` (amber → rose)
- `bg-gradient-mesh` (soft multi-point aurora)
- `text-gradient-primary`, `text-gradient-accent` (on display headings)

### Helper utilities (in globals.css)
- `.surface-card` / `.surface-card-hover` — pre-made card (now 6px radius)
- `.surface-inset` — inset muted surface
- `.surface-glass` — translucent blur panel
- `.chip` / `.chip-accent` — neutral / primary badge
- **`.chip-blue` / `.chip-violet` / `.chip-cyan` / `.chip-emerald` / `.chip-amber` / `.chip-rose`** — semantic chips (v0.2.1)
- **`.panel-info` / `.panel-success` / `.panel-warn` / `.panel-danger`** — soft accent alert panels (v0.2.1)
- **`.row-interactive`** — hoverable list row, supports `data-active="true"` (v0.2.1)
- **`.icon-tile`** + `.icon-tile-accent-{blue|violet|emerald|amber|rose|cyan}` — small square-ish icon tile (v0.2.1)
- **`.live-pill`** — emerald realtime pill with breathing dot (v0.2.1)
- **`.realtime-ping`** — wrap a dot with this to add an outward ping (v0.2.1)
- **`.progress-bar-indeterminate`** — looping sweep progress (v0.2.1)
- `.kicker` — small uppercase label (sections)
- `.dot-grid`, `.dot-grid-dense` — subtle bg pattern
- `.bg-aurora` — hero background glow
- `.shimmer` — skeleton loader
- `.stagger > *` — stagger fade-up children
- `.status-dot` + `.status-live | .status-warn | .status-idle | .status-danger`
- `.priority-critical | .priority-high | .priority-medium | .priority-low`

---

## Animation Contract

**Use Tailwind's built-ins or these custom ones only. Never write new keyframes.**

Entrance:
- `animate-fade-in` — simple opacity
- `animate-fade-up` — opacity + translateY(12px→0), 500ms spring
- `animate-fade-down` — from above
- `animate-scale-in` — 96% → 100%
- `animate-slide-in-from-*` — directional
- **`animate-blur-in`** — blur(8px)+fade, 550ms spring (v0.2.1 — for panels/heroes)
- **`animate-pop-in`** — 92%→100% with bounce-soft (v0.2.1 — for toasts, modals)
- **`animate-alert-in`** — top-down snap for alerts (v0.2.1)
- **`animate-toast-in`** — bottom-up pop for toasts (v0.2.1)
- **`animate-page-enter`** — blur+translate for route transitions (v0.2.1)
- `.stagger > *` — auto-delay children

Ambient (sparingly):
- `animate-pulse-subtle` — 2.2s gentle opacity pulse
- `animate-pulse-ring` — focus ring pulse
- `animate-gradient-pan` — moving gradient (with `bg-gradient-*`)
- `animate-aurora` — hero mesh drift
- **`animate-dot-breathe`** — 2.4s status dot breath (v0.2.1)

Transitions (v0.2.1 snappier defaults):
- `transition-all duration-150 ease-snap` — default for interactive (buttons, rows, chips)
- `transition-all duration-200 ease-smooth` — for larger surfaces (cards)
- `transition-colors duration-150` — color-only changes
- Hover lift: `hover:-translate-y-0.5` (not `active:scale-95`)

**Reduced motion:** all animations auto-disable via `@media (prefers-reduced-motion)`. Don't guard manually.

---

## Component Patterns

### Buttons (use `<Button>` from `@/components/ui/button`)
- Primary action: `variant="default"`
- Secondary: `variant="outline"`
- Tertiary: `variant="ghost"`
- Destructive: `variant="destructive"`
- Height scale: `sm` (32px), `default` (36px), `lg` (40px), `xl` (44px)
- **Never** write custom button markup when `<Button>` fits.

### Cards
- Prefer `className="surface-card surface-card-hover p-6"` over re-declaring border+bg+shadow
- Don't nest cards inside cards unless necessary; use `surface-inset` for subtle panels

### Badges / Chips
- Neutral: `<span className="chip">Label</span>`
- Accent/selected: `<span className="chip-accent">Label</span>`
- Semantic: build with `bg-accent-{hue}/10 text-accent-{hue} border border-accent-{hue}/20 rounded-full px-2.5 py-0.5 text-[11px]`

### Section headers
```tsx
<div className="space-y-2">
  <span className="kicker">Category</span>
  <h2 className="text-2xl font-semibold tracking-tight text-balance">Title</h2>
  <p className="text-sm text-muted-foreground max-w-2xl">Subtitle</p>
</div>
```

### Status indicators
```tsx
<span className="status-dot status-live" />   {/* green pulse */}
<span className="status-dot status-warn" />   {/* amber */}
<span className="status-dot status-danger" /> {/* rose */}
<span className="status-dot status-idle" />   {/* gray */}
```

### Focus rings
- All interactive elements: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- Already baked into `<Button>`, `<Input>`, `<Select>`, etc. Only add for custom buttons.

---

## What to REMOVE / REPLACE

When you encounter these patterns, clean them up:

| Remove | Replace with |
|---|---|
| `bg-gray-50 / bg-zinc-*` arbitrary classes | `bg-surface` / `bg-muted` tokens |
| Hardcoded hex colors | token variable |
| Multiple stacked cards (card-in-card-in-card) | Single card, use spacing |
| `border border-gray-200` | `border border-border` |
| `text-gray-500 / text-slate-400` | `text-muted-foreground` |
| `shadow-lg shadow-2xl` (heavy shadows) | `shadow-sm` / `shadow-md` |
| Raw `animate-bounce` / `animate-ping` for decoration | `animate-pulse-subtle` or remove |
| `active:scale-95` stale click effect | remove (use subtle color change or keep default) |
| `rounded-full` on non-circular buttons | `rounded-md` |
| **`rounded-xl` / `rounded-2xl` on generic cards** | `rounded-lg` (6px) — v0.2.1 |
| **`rounded-xl` on buttons/inputs** | `rounded-md` (4px) — v0.2.1 |
| Mixed icon sizes on one row | uniform `h-4 w-4` |
| "icon + label + chevron + badge + kbd" crammed rows | pick 2–3 max |
| Empty states with icon + heading + body + 2 buttons | icon + one line + one button |

### Clutter rules (user explicitly asked for less)
- If a page has >3 distinct vertical sections above the fold, consolidate.
- If a list row has >4 visual elements (icon, title, meta, 3 chips, menu), drop the lowest-value ones.
- Stat tiles: max 4 per row, each ≤ 140px tall, 1 number + 1 label + optional trend.
- Don't use `mb-*` + `space-y-*` + `gap-*` all at once; pick one spacing mechanism per container.

---

## Do NOT

- ❌ Edit `apps/web/src/app/globals.css`, `tailwind.config.ts`, or `components/providers.tsx`
- ❌ Add new CSS files or new keyframes
- ❌ Install new npm packages
- ❌ Run `git commit`, `git push`, or any docker command
- ❌ Change the theme provider setup or `next-themes` wiring
- ❌ Introduce emojis into source files (user explicitly said no emojis in code)
- ❌ Change routing, API contracts, data fetching, or business logic
- ❌ Delete files unless they become fully unused as a side-effect of your UI refactor

## DO

- ✅ Replace hardcoded colors with tokens
- ✅ Use `surface-card`, `chip`, `kicker`, `stagger`, etc.
- ✅ Add `animate-fade-up`, stagger, or `transition-all duration-200 ease-smooth` where it feels natural
- ✅ Simplify markup — fewer wrappers, fewer cards
- ✅ Tighten copy / shorten rows if they feel crowded
- ✅ Ensure dark + light mode both look intentional (check `bg-background`, not `bg-white`)
- ✅ Keep accessibility: `aria-label`, focus rings, semantic HTML, `prefers-reduced-motion`

---

## Scope Discipline

Each agent owns a specific file list. **Do not edit files outside your scope** — another agent owns them.
If you notice an issue elsewhere, mention it in your final report but don't touch it.
