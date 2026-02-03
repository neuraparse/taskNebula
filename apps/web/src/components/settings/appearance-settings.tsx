'use client';

import { useTheme } from 'next-themes';
import { useThemeStore, themeInfo, type ColorTheme, type VisualStyle } from '@/lib/stores/theme-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Check, Moon, Sun, Monitor, Sparkles, Layers, Minus } from 'lucide-react';
import { useEffect } from 'react';

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
  } = useThemeStore();

  // Apply theme attributes to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
    document.documentElement.setAttribute('data-visual', visualStyle);
    document.documentElement.setAttribute('data-animations', String(enableAnimations));
  }, [colorTheme, visualStyle, enableAnimations]);

  const colorThemes: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'purple', 'rose'];
  const visualStyles: { value: VisualStyle; label: string; icon: React.ElementType; description: string }[] = [
    { value: 'modern', label: 'Modern', icon: Sparkles, description: 'Clean shadows and subtle effects' },
    { value: 'glass', label: 'Glass', icon: Layers, description: 'Frosted glass morphism' },
    { value: 'minimal', label: 'Minimal', icon: Minus, description: 'Flat and simple' },
  ];

  return (
    <div className="space-y-6">
      {/* Color Mode */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="text-lg">Color Mode</CardTitle>
          <CardDescription>Choose between light, dark, or system preference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => setTheme(mode.value)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 hover:bg-accent/50',
                  theme === mode.value
                    ? 'border-primary bg-primary/5 glow-theme-sm'
                    : 'border-border hover:border-primary/30'
                )}
              >
                <mode.icon className={cn('h-5 w-5', theme === mode.value && 'text-primary')} />
                <span className={cn('text-sm font-medium', theme === mode.value && 'text-primary')}>
                  {mode.label}
                </span>
                {theme === mode.value && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color Theme */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="text-lg">Color Theme</CardTitle>
          <CardDescription>Select your preferred accent color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {colorThemes.map((t) => {
              const info = themeInfo[t];
              return (
                <button
                  key={t}
                  onClick={() => setColorTheme(t)}
                  className={cn(
                    'relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200 hover:bg-accent/50',
                    colorTheme === t
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {info.preview.map((color, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-full ring-1 ring-white/20"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', colorTheme === t && 'text-primary')}>
                      {info.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  {colorTheme === t && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Visual Style */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="text-lg">Visual Style</CardTitle>
          <CardDescription>Choose the overall appearance style</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {visualStyles.map((style) => (
              <button
                key={style.value}
                onClick={() => setVisualStyle(style.value)}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all duration-200 hover:bg-accent/50',
                  visualStyle === style.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                )}
              >
                <style.icon className={cn('h-5 w-5', visualStyle === style.value && 'text-primary')} />
                <div>
                  <p className={cn('text-sm font-semibold', visualStyle === style.value && 'text-primary')}>
                    {style.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
                {visualStyle === style.value && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Effects */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="text-lg">Effects</CardTitle>
          <CardDescription>Toggle visual effects and animations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="animations" className="text-sm font-medium">
                Animations
              </Label>
              <p className="text-xs text-muted-foreground">Enable smooth transitions and animations</p>
            </div>
            <Switch
              id="animations"
              checked={enableAnimations}
              onCheckedChange={setEnableAnimations}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gradients" className="text-sm font-medium">
                Gradients
              </Label>
              <p className="text-xs text-muted-foreground">Use gradient backgrounds and accents</p>
            </div>
            <Switch
              id="gradients"
              checked={enableGradients}
              onCheckedChange={setEnableGradients}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="card-gradient-border overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
          <CardDescription>See how your theme looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-theme-gradient" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Sample Card Title</p>
                <p className="text-xs text-muted-foreground">This is how your content will look</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Action
              </button>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Label
              </span>
              <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                Muted
              </span>
              <span className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                Alert
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-2/3 bg-theme-gradient rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
