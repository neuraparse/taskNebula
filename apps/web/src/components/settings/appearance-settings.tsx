'use client';

import { useTheme } from 'next-themes';
import { useThemeStore, themeInfo, type ColorTheme, type VisualStyle } from '@/lib/stores/theme-store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Moon, Sun, Monitor, Sparkles, Layers, Minus, RotateCcw } from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

const COLOR_MODES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const VISUAL_STYLES: {
  value: VisualStyle;
  label: string;
  icon: React.ElementType;
  description: string;
  swatchClasses: string[];
}[] = [
  {
    value: 'modern',
    label: 'Modern',
    icon: Sparkles,
    description: 'Clean shadows and subtle effects',
    swatchClasses: [
      'bg-card border border-border shadow-sm',
      'bg-muted border border-border shadow-xs',
      'bg-primary/20 border border-primary/30',
    ],
  },
  {
    value: 'glass',
    label: 'Glass',
    icon: Layers,
    description: 'Frosted glass morphism',
    swatchClasses: [
      'bg-white/10 backdrop-blur border border-white/20',
      'bg-white/5 backdrop-blur border border-white/10',
      'bg-primary/10 backdrop-blur border border-primary/20',
    ],
  },
  {
    value: 'minimal',
    label: 'Minimal',
    icon: Minus,
    description: 'Flat and simple',
    swatchClasses: [
      'bg-background border border-border',
      'bg-muted',
      'bg-primary/10',
    ],
  },
];

const COLOR_THEMES: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'purple', 'rose'];

// ─── component ──────────────────────────────────────────────────────────────

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const {
    colorTheme,
    visualStyle,
    enableAnimations,
    enableGradients,
    setColorTheme,
    setVisualStyle,
    setEnableAnimations,
    setEnableGradients,
    reset,
  } = useThemeStore();

  // ThemeInitializer in providers writes data-theme / data-visual /
  // data-animations / data-gradients globally — no duplicate useEffect here.

  function handleReset() {
    try {
      reset();
    } catch {
      // fallback if reset() is unavailable
      setColorTheme('default');
      setVisualStyle('modern');
      setEnableAnimations(true);
      setEnableGradients(true);
    }
    setTheme('system');
  }

  const modeName =
    theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';
  const colorThemeName = themeInfo[colorTheme]?.name ?? colorTheme;
  const visualStyleName =
    visualStyle === 'modern' ? 'Modern' : visualStyle === 'glass' ? 'Glass' : 'Minimal';

  return (
    <div className="animate-fade-in space-y-8">

      {/* ── Color Mode ────────────────────────────────────────────────── */}
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <span className="kicker">Preference</span>
          <h2 className="text-xl font-semibold">Color Mode</h2>
          <p className="text-sm text-muted-foreground">Choose between light, dark, or system preference.</p>
        </div>

        <div
          role="group"
          aria-labelledby="color-mode-heading"
          className="grid grid-cols-3 gap-3"
        >
          <span id="color-mode-heading" className="sr-only">Color mode selection</span>
          {COLOR_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              aria-pressed={theme === mode.value}
              onClick={() => setTheme(mode.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                theme === mode.value
                  ? 'border-primary bg-primary/10 text-primary shadow-glow-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:border-primary/30'
              )}
            >
              <mode.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{mode.label}</span>
              {theme === mode.value && (
                <span className="absolute right-2 top-2" aria-hidden="true">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Color Theme ───────────────────────────────────────────────── */}
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <span className="kicker">Palette</span>
          <h2 className="text-xl font-semibold">Color Theme</h2>
          <p className="text-sm text-muted-foreground">Select your preferred accent color.</p>
        </div>

        <div
          role="group"
          aria-labelledby="color-theme-heading"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <span id="color-theme-heading" className="sr-only">Color theme selection</span>
          {COLOR_THEMES.map((t) => {
            const info = themeInfo[t];
            const [primary, blend1, blend2] = info.preview;
            const isActive = colorTheme === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={isActive}
                onClick={() => setColorTheme(t)}
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-glow-primary'
                    : 'border-border hover:bg-accent/50 hover:border-primary/30'
                )}
              >
                {/* large primary chip + two smaller accent chips */}
                <div className="flex items-end gap-1.5">
                  <div
                    className="h-8 w-8 rounded-md shadow-xs ring-1 ring-border"
                    style={{ backgroundColor: primary }}
                    aria-hidden="true"
                  />
                  <div
                    className="h-5 w-5 rounded-sm shadow-xs ring-1 ring-border"
                    style={{ backgroundColor: blend1 }}
                    aria-hidden="true"
                  />
                  <div
                    className="h-4 w-4 rounded-sm shadow-xs ring-1 ring-border"
                    style={{ backgroundColor: blend2 }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                    {info.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </div>
                {isActive && (
                  <span className="absolute right-2 top-2 text-primary" aria-hidden="true">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Visual Style ──────────────────────────────────────────────── */}
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <span className="kicker">Appearance</span>
          <h2 className="text-xl font-semibold">Visual Style</h2>
          <p className="text-sm text-muted-foreground">Choose the overall appearance style.</p>
        </div>

        <div
          role="group"
          aria-labelledby="visual-style-heading"
          className="grid grid-cols-3 gap-3"
        >
          <span id="visual-style-heading" className="sr-only">Visual style selection</span>
          {VISUAL_STYLES.map((style) => {
            const isActive = visualStyle === style.value;
            return (
              <button
                key={style.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setVisualStyle(style.value)}
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-lg border-2 p-4 transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:bg-accent/50 hover:border-primary/30'
                )}
              >
                {/* inline style swatches */}
                <div className="flex gap-1" aria-hidden="true">
                  {style.swatchClasses.map((cls, i) => (
                    <div key={i} className={cn('h-4 w-4 rounded-sm', cls)} />
                  ))}
                </div>
                <style.icon
                  className={cn('h-5 w-5', isActive ? 'text-primary' : '')}
                  aria-hidden="true"
                />
                <div>
                  <p className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                    {style.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
                {isActive && (
                  <span className="absolute right-2 top-2 text-primary" aria-hidden="true">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Effects ───────────────────────────────────────────────────── */}
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <span className="kicker">Effects</span>
          <h2 className="text-xl font-semibold">Motion & Gradients</h2>
          <p className="text-sm text-muted-foreground">Toggle visual effects and animations.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="animations" className="text-sm font-medium">Animations</Label>
              <p className="text-xs text-muted-foreground">Enable smooth transitions and animations.</p>
            </div>
            <Switch id="animations" checked={enableAnimations} onCheckedChange={setEnableAnimations} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gradients" className="text-sm font-medium">Gradients</Label>
              <p className="text-xs text-muted-foreground">Use gradient backgrounds and accents.</p>
            </div>
            <Switch id="gradients" checked={enableGradients} onCheckedChange={setEnableGradients} />
          </div>
        </div>
      </div>

      {/* ── Live Preview ──────────────────────────────────────────────── */}
      <div className="surface-card p-6 space-y-4">
        <div className="space-y-1">
          <span className="kicker">Preview</span>
          <h2 className="text-xl font-semibold">Live Preview</h2>
          <p className="text-sm text-muted-foreground">See how your theme looks in context.</p>
        </div>

        {/* currently-applied label */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="kicker">Currently applied</span>
          <span className="chip">{modeName}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="chip">{colorThemeName}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="chip">{visualStyleName}</span>
        </div>

        <div className="surface-inset rounded-lg p-4 space-y-4">

          {/* gradient swatch + card header */}
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 flex-shrink-0 rounded-lg"
              style={enableGradients ? undefined : { background: 'hsl(var(--primary))' }}
              aria-hidden="true"
            >
              {enableGradients && <div className="h-full w-full rounded-lg bg-theme-gradient" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Sample Card Title</p>
              <p className="text-xs text-muted-foreground truncate">This is how your content will look</p>
            </div>
            {/* animations indicator dot */}
            {enableAnimations && (
              <span
                className="h-2 w-2 rounded-full bg-primary animate-pulse-subtle flex-shrink-0"
                aria-label="Animations active"
              />
            )}
          </div>

          {/* mini nav pills */}
          <div role="tablist" aria-label="Navigation preview" className="flex gap-1.5 flex-wrap">
            {['Home', 'Projects', 'Settings'].map((nav, i) => (
              <span
                key={nav}
                role="tab"
                aria-selected={i === 0}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors duration-200',
                  i === 0
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {nav}
              </span>
            ))}
          </div>

          {/* status chip row */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="chip-accent">Active</span>
            <span className="chip">Muted</span>
            <span className="rounded-full border border-accent-emerald/20 bg-accent-emerald/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-emerald">
              Live
            </span>
            <span className="rounded-full border border-accent-amber/20 bg-accent-amber/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-amber">
              Pending
            </span>
            <span className="rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
              Alert
            </span>
          </div>

          {/* button group */}
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant="default">Primary</Button>
            <Button size="sm" variant="outline">Outline</Button>
            <Button size="sm" variant="destructive">Destructive</Button>
          </div>

          {/* mini bar chart */}
          <div aria-label="Color preview chart" className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Color preview</p>
            <div className="flex items-end gap-1 h-10">
              {[
                { width: 'w-full', opacity: 'bg-primary', label: '100%' },
                { width: 'w-4/5', opacity: 'bg-primary/60', label: '80%' },
                { width: 'w-3/5', opacity: 'bg-primary/30', label: '60%' },
              ].map(({ width, opacity, label }, i) => (
                <div key={i} className="flex-1 flex items-end">
                  <div
                    className={cn('w-full rounded-t-sm transition-all duration-300', opacity, width)}
                    style={{ height: `${(3 - i) * 33}%` }}
                    aria-label={label}
                  />
                </div>
              ))}
              {[...Array(5)].map((_, i) => (
                <div key={`extra-${i}`} className="flex-1 flex items-end">
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-all duration-300',
                      i % 2 === 0 ? 'bg-primary/30' : 'bg-primary/20'
                    )}
                    style={{ height: `${20 + (i % 3) * 20}%` }}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Reset ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>

    </div>
  );
}
