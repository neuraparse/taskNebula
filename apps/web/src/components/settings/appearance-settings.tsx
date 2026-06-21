'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  useThemeStore,
  themeInfo,
  type ColorTheme,
  type InterfaceFont,
  type VisualStyle,
} from '@/lib/stores/theme-store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Moon, Sun, Monitor, RotateCcw, Cloud, CloudOff, Loader2 } from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

const COLOR_MODES = [
  { value: 'light', labelKey: 'appearance.mode_light', icon: Sun },
  { value: 'dark', labelKey: 'appearance.mode_dark', icon: Moon },
  { value: 'system', labelKey: 'appearance.mode_system', icon: Monitor },
] as const;

const VISUAL_STYLES: { value: VisualStyle; labelKey: string }[] = [
  { value: 'modern', labelKey: 'appearance.style_modern' },
  { value: 'glass', labelKey: 'appearance.style_glass' },
  { value: 'minimal', labelKey: 'appearance.style_minimal' },
];

const INTERFACE_FONTS: {
  value: InterfaceFont;
  labelKey: string;
  descKey: string;
  sampleClassName: string;
}[] = [
  {
    value: 'brand',
    labelKey: 'appearance.font_brand',
    descKey: 'appearance.font_brand_desc',
    sampleClassName: "font-['Plus_Jakarta_Sans']",
  },
  {
    value: 'ibm',
    labelKey: 'appearance.font_ibm',
    descKey: 'appearance.font_ibm_desc',
    sampleClassName: "font-['IBM_Plex_Sans']",
  },
];

const COLOR_THEMES: ColorTheme[] = ['default', 'ocean', 'forest', 'sunset', 'purple', 'rose'];

interface ServerAppearanceResponse {
  settings: {
    userId: string;
    theme: 'light' | 'dark' | 'system' | null;
    colorTheme: string | null;
    visualStyle: string | null;
    interfaceFont: string | null;
    animationsEnabled: boolean;
    gradientsEnabled: boolean;
    updatedAt: string | null;
  };
}

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── component ──────────────────────────────────────────────────────────────

export function AppearanceSettings() {
  const t = useTranslations('settingsConfig');
  const { theme, setTheme } = useTheme();
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated';

  const {
    colorTheme,
    visualStyle,
    interfaceFont,
    enableAnimations,
    enableGradients,
    setColorTheme,
    setVisualStyle,
    setInterfaceFont,
    setEnableAnimations,
    setEnableGradients,
    hydrateFromServer,
    reset,
  } = useThemeStore();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Fetch server settings — only runs when a session exists, so the landing
  // page / other unauthenticated surfaces never hit the authed API.
  const { data: serverData } = useQuery<ServerAppearanceResponse>({
    queryKey: ['user-appearance'],
    queryFn: async () => {
      const res = await fetch('/api/user/appearance');
      if (!res.ok) throw new Error(t('appearance.load_failed'));
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Track whether we've already hydrated from server in this mount so we
  // don't fight the user's ongoing edits if the query re-runs.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!serverData?.settings || hydratedRef.current) return;
    const s = serverData.settings;
    hydrateFromServer({
      colorTheme: s.colorTheme,
      visualStyle: s.visualStyle,
      interfaceFont: s.interfaceFont,
      animationsEnabled: s.animationsEnabled,
      gradientsEnabled: s.gradientsEnabled,
    });
    if (s.theme) {
      // next-themes owns its own storage; align it with server-side value.
      setTheme(s.theme);
    }
    hydratedRef.current = true;
  }, [serverData, hydrateFromServer, setTheme]);

  // Debounced PUT on any client-side change. Skip the very first render so we
  // don't immediately write back the defaults before hydration completes.
  const skipFirstSyncRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<Record<string, unknown>>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false;
      return;
    }
    // Wait until we've seen the server row before pushing updates, otherwise
    // a fresh-page edit could race the initial GET and overwrite server state
    // with not-yet-hydrated defaults.
    if (!hydratedRef.current) return;

    latestPayloadRef.current = {
      theme,
      colorTheme,
      visualStyle,
      interfaceFont,
      animationsEnabled: enableAnimations,
      gradientsEnabled: enableGradients,
    };

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      setSyncStatus('saving');
      try {
        const res = await fetch('/api/user/appearance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(latestPayloadRef.current),
        });
        if (!res.ok) throw new Error('PUT failed');
        setSyncStatus('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSyncStatus('idle'), 1500);
      } catch (err) {
        console.error('Failed to sync appearance settings', err);
        setSyncStatus('error');
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    isAuthenticated,
    theme,
    colorTheme,
    visualStyle,
    interfaceFont,
    enableAnimations,
    enableGradients,
  ]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleReset = useCallback(() => {
    try {
      reset();
    } catch {
      setColorTheme('default');
      setVisualStyle('modern');
      setInterfaceFont('brand');
      setEnableAnimations(true);
      setEnableGradients(true);
    }
    setTheme('system');
  }, [
    reset,
    setColorTheme,
    setVisualStyle,
    setInterfaceFont,
    setEnableAnimations,
    setEnableGradients,
    setTheme,
  ]);

  return (
    <div className="animate-fade-up stagger space-y-8">
      {/* Sync indicator */}
      {isAuthenticated && (
        <div
          aria-live="polite"
          className={cn(
            'flex items-center justify-end gap-1.5 text-xs transition-opacity duration-200',
            syncStatus === 'idle'
              ? 'text-muted-foreground/70'
              : syncStatus === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
          )}
        >
          {syncStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>{t('appearance.sync_saving')}</span>
            </>
          )}
          {syncStatus === 'saved' && (
            <>
              <Cloud className="h-3 w-3" aria-hidden="true" />
              <span>{t('appearance.sync_synced')}</span>
            </>
          )}
          {syncStatus === 'error' && (
            <>
              <CloudOff className="h-3 w-3" aria-hidden="true" />
              <span>{t('appearance.sync_error')}</span>
            </>
          )}
          {syncStatus === 'idle' && (
            <>
              <Cloud className="h-3 w-3" aria-hidden="true" />
              <span>{t('appearance.sync_idle')}</span>
            </>
          )}
        </div>
      )}

      {/* Color Mode */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">{t('appearance.preference_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('appearance.color_mode_heading')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('appearance.color_mode_desc')}
          </p>
        </div>
        <div className="surface-card rounded-lg p-6">
          <div role="group" aria-labelledby="color-mode-heading" className="grid grid-cols-3 gap-3">
            <span id="color-mode-heading" className="sr-only">
              {t('appearance.color_mode_sr')}
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
                    'ease-snap flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-all duration-150',
                    'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <mode.icon className="h-4 w-4" />
                  {t(mode.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Color Theme — swatch grid per spec */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">{t('appearance.palette_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('appearance.color_theme_heading')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('appearance.color_theme_desc')}
          </p>
        </div>
        <div className="surface-card rounded-lg p-6">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t('appearance.accent_label')}</Label>
              <p className="text-muted-foreground mt-1 text-xs">
                {themeInfo[colorTheme]?.name ?? colorTheme}
              </p>
            </div>
            <div
              role="group"
              aria-labelledby="color-theme-heading"
              className="flex flex-wrap gap-3"
            >
              <span id="color-theme-heading" className="sr-only">
                {t('appearance.color_theme_sr')}
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
                      'border-border ease-snap relative h-10 w-10 rounded-md border transition-all duration-150',
                      'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      isActive && 'ring-ring ring-offset-background ring-2 ring-offset-2'
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
          <span className="kicker">{t('appearance.appearance_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('appearance.visual_style_heading')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('appearance.visual_style_desc')}
          </p>
        </div>
        <div className="surface-card rounded-lg p-6">
          <div
            role="group"
            aria-labelledby="visual-style-heading"
            className="grid grid-cols-3 gap-3"
          >
            <span id="visual-style-heading" className="sr-only">
              {t('appearance.visual_style_sr')}
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
                    'ease-snap flex items-center justify-center rounded-md border px-3 py-2.5 text-sm transition-all duration-150',
                    'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {t(style.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interface Font */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">{t('appearance.appearance_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('appearance.interface_font_heading')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('appearance.interface_font_desc')}
          </p>
        </div>
        <div className="surface-card rounded-lg p-6">
          <div
            role="group"
            aria-labelledby="interface-font-heading"
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <span id="interface-font-heading" className="sr-only">
              {t('appearance.interface_font_sr')}
            </span>
            {INTERFACE_FONTS.map((font) => {
              const isActive = interfaceFont === font.value;
              return (
                <button
                  key={font.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setInterfaceFont(font.value)}
                  className={cn(
                    'ease-snap flex min-h-[112px] flex-col items-start justify-between rounded-md border p-4 text-left transition-all duration-150',
                    'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span>
                      <span className="text-foreground block text-sm font-semibold">
                        {t(font.labelKey)}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs leading-5">
                        {t(font.descKey)}
                      </span>
                    </span>
                    {isActive ? <Check className="text-primary h-4 w-4 shrink-0" /> : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'text-foreground mt-4 block text-2xl font-semibold leading-none',
                      font.sampleClassName
                    )}
                  >
                    {t('appearance.font_sample')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Effects */}
      <section className="space-y-4">
        <div className="space-y-1">
          <span className="kicker">{t('appearance.effects_kicker')}</span>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('appearance.effects_heading')}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t('appearance.effects_desc')}
          </p>
        </div>
        <div className="surface-card space-y-5 rounded-lg p-6">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <Label htmlFor="animations" className="text-sm font-medium">
              {t('appearance.animations_label')}
            </Label>
            <div className="flex md:justify-end">
              <Switch
                id="animations"
                checked={enableAnimations}
                onCheckedChange={setEnableAnimations}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
            <Label htmlFor="gradients" className="text-sm font-medium">
              {t('appearance.gradients_label')}
            </Label>
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
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('appearance.reset_to_defaults')}
        </Button>
      </div>
    </div>
  );
}
