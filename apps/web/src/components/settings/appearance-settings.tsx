'use client';

import { useTheme } from 'next-themes';
import { useThemeStore, themeInfo, type ColorTheme, type VisualStyle } from '@/lib/stores/theme-store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Moon, Sun, Monitor, RotateCcw } from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

const COLOR_MODES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const VISUAL_STYLES: { value: VisualStyle; label: string }[] = [
  { value: 'modern', label: 'Modern' },
  { value: 'glass', label: 'Glass' },
  { value: 'minimal', label: 'Minimal' },
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

  function handleReset() {
    try {
      reset();
    } catch {
      setColorTheme('default');
      setVisualStyle('modern');
      setEnableAnimations(true);
      setEnableGradients(true);
    }
    setTheme('system');
  }

  return (
    <div className="animate-fade-up space-y-8 stagger">
      {/* Color Mode */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Preference</span>
          <h2 className="text-lg font-semibold tracking-tight">Color mode</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Choose between light, dark, or match system preference.
          </p>
        </div>
        <div className="surface-card p-5">
          <div
            role="group"
            aria-labelledby="color-mode-heading"
            className="grid grid-cols-3 gap-3"
          >
            <span id="color-mode-heading" className="sr-only">
              Color mode selection
            </span>
            {COLOR_MODES.map((mode) => {
              const isActive = theme === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setTheme(mode.value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <mode.icon className="h-4 w-4" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Color Theme — swatch grid per spec */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Palette</span>
          <h2 className="text-lg font-semibold tracking-tight">Color theme</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Primary hue used for interactive and brand accents.
          </p>
        </div>
        <div className="surface-card p-5">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Accent</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {themeInfo[colorTheme]?.name ?? colorTheme}
              </p>
            </div>
            <div
              role="group"
              aria-labelledby="color-theme-heading"
              className="flex flex-wrap gap-3"
            >
              <span id="color-theme-heading" className="sr-only">
                Color theme selection
              </span>
              {COLOR_THEMES.map((t) => {
                const info = themeInfo[t];
                const [primary] = info.preview;
                const isActive = colorTheme === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-label={info.name}
                    aria-pressed={isActive}
                    data-theme={t}
                    onClick={() => setColorTheme(t)}
                    className={cn(
                      'relative h-10 w-10 rounded-md border border-border transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive &&
                        'ring-2 ring-ring ring-offset-2 ring-offset-background'
                    )}
                    style={{ background: primary }}
                  >
                    {isActive && (
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Visual Style */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Appearance</span>
          <h2 className="text-lg font-semibold tracking-tight">Visual style</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Overall surface treatment across the workspace.
          </p>
        </div>
        <div className="surface-card p-5">
          <div
            role="group"
            aria-labelledby="visual-style-heading"
            className="grid grid-cols-3 gap-3"
          >
            <span id="visual-style-heading" className="sr-only">
              Visual style selection
            </span>
            {VISUAL_STYLES.map((style) => {
              const isActive = visualStyle === style.value;
              return (
                <button
                  key={style.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setVisualStyle(style.value)}
                  className={cn(
                    'flex items-center justify-center rounded-md border px-3 py-2.5 text-sm transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Effects */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">Effects</span>
          <h2 className="text-lg font-semibold tracking-tight">Motion & gradients</h2>
          <p className="text-sm text-muted-foreground max-w-prose">
            Toggle ambient animation and gradient surfaces.
          </p>
        </div>
        <div className="surface-card p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label htmlFor="animations" className="text-sm font-medium">
                Animations
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Smooth transitions and entrance motion.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Switch
                id="animations"
                checked={enableAnimations}
                onCheckedChange={setEnableAnimations}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
            <div className="space-y-1">
              <Label htmlFor="gradients" className="text-sm font-medium">
                Gradients
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Gradient accents on hero surfaces.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Switch
                id="gradients"
                checked={enableGradients}
                onCheckedChange={setEnableGradients}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Reset */}
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
