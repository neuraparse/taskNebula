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

type ColorMode = (typeof COLOR_MODES)[number]['value'];

const COLOR_MODE_STORAGE_KEY = 'tasknebula-color-mode';
const PENDING_COLOR_MODE_STORAGE_KEY = 'tasknebula-color-mode-pending-sync';
const LEGACY_COLOR_MODE_STORAGE_KEY = 'theme';

function isColorMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getStoredColorMode(): ColorMode | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedColorMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (isColorMode(storedColorMode)) return storedColorMode;

    const legacyColorMode = window.localStorage.getItem(LEGACY_COLOR_MODE_STORAGE_KEY);
    if (isColorMode(legacyColorMode)) return legacyColorMode;
  } catch {
    return null;
  }

  return null;
}

function getPendingColorMode(): ColorMode | null {
  if (typeof window === 'undefined') return null;

  try {
    const pendingColorMode = window.localStorage.getItem(PENDING_COLOR_MODE_STORAGE_KEY);
    return isColorMode(pendingColorMode) ? pendingColorMode : null;
  } catch {
    return null;
  }
}

function storeColorMode(mode: ColorMode, options: { pendingSync?: boolean } = {}) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    if (options.pendingSync) {
      window.localStorage.setItem(PENDING_COLOR_MODE_STORAGE_KEY, mode);
    }
    window.localStorage.removeItem(LEGACY_COLOR_MODE_STORAGE_KEY);
  } catch {
    // Browsers can deny storage in private contexts. The server sync still
    // preserves the preference for authenticated users.
  }
}

function clearPendingColorMode(mode?: ColorMode) {
  if (typeof window === 'undefined') return;

  try {
    const pendingColorMode = getPendingColorMode();
    if (!pendingColorMode || (mode && pendingColorMode !== mode)) return;
    window.localStorage.removeItem(PENDING_COLOR_MODE_STORAGE_KEY);
  } catch {
    // Ignore storage failures; a stale pending marker only makes the next
    // Appearance mount re-assert the same local preference.
  }
}

function shouldLocalColorModeWin(localMode: ColorMode, serverMode: ColorMode | null) {
  if (!serverMode || localMode === serverMode) return true;
  if (localMode !== 'system') return true;

  // A stored `system` can be a stale next-themes default. Do not let it wipe a
  // real saved light/dark server preference on the next Appearance mount.
  return serverMode === 'system';
}

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
const COLOR_THEME_LABEL_KEYS: Record<ColorTheme, string> = {
  default: 'appearance.theme_default',
  ocean: 'appearance.theme_ocean',
  forest: 'appearance.theme_forest',
  sunset: 'appearance.theme_sunset',
  purple: 'appearance.theme_purple',
  rose: 'appearance.theme_rose',
};

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
  const [serverHydrated, setServerHydrated] = useState(false);
  const [selectedColorMode, setSelectedColorMode] = useState<ColorMode>(
    () => getStoredColorMode() ?? 'system'
  );

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
  const syncedStoredColorModeRef = useRef(false);
  const localColorModeTouchedRef = useRef(false);
  // Debounced PUT on any client-side change. Skip the first hydrated pass so
  // default `system` does not get written until the user explicitly selects it.
  const skipFirstSyncRef = useRef(true);
  const skipNextSyncPayloadRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<Record<string, unknown>>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildAppearancePayload = useCallback(
    (mode: ColorMode = selectedColorMode) => ({
      theme: mode,
      colorTheme,
      visualStyle,
      interfaceFont,
      animationsEnabled: enableAnimations,
      gradientsEnabled: enableGradients,
    }),
    [selectedColorMode, colorTheme, visualStyle, interfaceFont, enableAnimations, enableGradients]
  );

  const persistAppearance = useCallback(
    async (payload: Record<string, unknown>) => {
      setSyncStatus('saving');
      try {
        const res = await fetch('/api/user/appearance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(t('appearance.save_failed'));
        if (isColorMode(payload.theme)) {
          clearPendingColorMode(payload.theme);
        }
        setSyncStatus('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSyncStatus('idle'), 1500);
      } catch (err) {
        console.error('Failed to sync appearance settings', err);
        setSyncStatus('error');
      }
    },
    [t]
  );

  useEffect(() => {
    const storedColorMode = getStoredColorMode();
    if (storedColorMode) {
      setSelectedColorMode(storedColorMode);
      if (theme !== storedColorMode) {
        setTheme(storedColorMode);
      }
      return;
    }

    if (isColorMode(theme)) {
      setSelectedColorMode(theme);
    }
  }, [setTheme, theme]);

  useEffect(() => {
    if (!serverData?.settings || hydratedRef.current) return;
    const s = serverData.settings;
    const hasPersistedServerSettings = Boolean(s.updatedAt);
    const storedColorMode = getStoredColorMode();
    const pendingColorMode = getPendingColorMode();
    const localColorMode = pendingColorMode ?? storedColorMode;
    const serverColorMode = isColorMode(s.theme) ? s.theme : null;

    if (hasPersistedServerSettings) {
      hydrateFromServer({
        colorTheme: s.colorTheme,
        visualStyle: s.visualStyle,
        interfaceFont: s.interfaceFont,
        animationsEnabled: s.animationsEnabled,
        gradientsEnabled: s.gradientsEnabled,
      });
    }

    if (
      localColorMode &&
      (!hasPersistedServerSettings ||
        pendingColorMode === localColorMode ||
        localColorModeTouchedRef.current ||
        shouldLocalColorModeWin(localColorMode, serverColorMode))
    ) {
      storeColorMode(localColorMode);
      setSelectedColorMode(localColorMode);
      if (theme !== localColorMode) {
        setTheme(localColorMode);
      }

      if (
        !syncedStoredColorModeRef.current &&
        (!hasPersistedServerSettings ||
          serverColorMode !== localColorMode ||
          pendingColorMode === localColorMode) &&
        (localColorMode !== 'system' ||
          pendingColorMode === localColorMode ||
          localColorModeTouchedRef.current)
      ) {
        const localAppearancePayload = hasPersistedServerSettings
          ? { theme: localColorMode }
          : {
              theme: localColorMode,
              colorTheme,
              visualStyle,
              interfaceFont,
              animationsEnabled: enableAnimations,
              gradientsEnabled: enableGradients,
            };
        syncedStoredColorModeRef.current = true;
        void persistAppearance(localAppearancePayload);
      }
    } else if (hasPersistedServerSettings && serverColorMode) {
      // next-themes owns its own storage; align it with a saved server value
      // only when this browser has no explicit color-mode choice.
      storeColorMode(serverColorMode);
      setSelectedColorMode(serverColorMode);
      if (theme !== serverColorMode) {
        setTheme(serverColorMode);
      }
    }

    hydratedRef.current = true;
    setServerHydrated(true);
  }, [
    serverData,
    hydrateFromServer,
    setTheme,
    colorTheme,
    visualStyle,
    interfaceFont,
    enableAnimations,
    enableGradients,
    persistAppearance,
    theme,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!serverHydrated || !hydratedRef.current) return;
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false;
      return;
    }

    latestPayloadRef.current = buildAppearancePayload();

    const payloadSignature = JSON.stringify(latestPayloadRef.current);
    if (skipNextSyncPayloadRef.current === payloadSignature) {
      skipNextSyncPayloadRef.current = null;
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      await persistAppearance(latestPayloadRef.current);
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    isAuthenticated,
    selectedColorMode,
    colorTheme,
    visualStyle,
    interfaceFont,
    enableAnimations,
    enableGradients,
    serverHydrated,
    buildAppearancePayload,
    persistAppearance,
  ]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleColorModeChange = useCallback(
    (mode: ColorMode) => {
      localColorModeTouchedRef.current = true;
      storeColorMode(mode, { pendingSync: true });
      setSelectedColorMode(mode);
      setTheme(mode);

      if (isAuthenticated && serverHydrated) {
        const payload = buildAppearancePayload(mode);
        skipNextSyncPayloadRef.current = JSON.stringify(payload);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        void persistAppearance(payload);
      }
    },
    [buildAppearancePayload, isAuthenticated, persistAppearance, serverHydrated, setTheme]
  );

  const handleReset = useCallback(() => {
    localColorModeTouchedRef.current = true;
    try {
      reset();
    } catch {
      setColorTheme('default');
      setVisualStyle('modern');
      setInterfaceFont('ibm');
      setEnableAnimations(true);
      setEnableGradients(true);
    }
    storeColorMode('system');
    setSelectedColorMode('system');
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
              const isActive = selectedColorMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleColorModeChange(mode.value)}
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
                {t(COLOR_THEME_LABEL_KEYS[colorTheme] ?? 'appearance.theme_default')}
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
              {COLOR_THEMES.map((themeKey) => {
                const info = themeInfo[themeKey];
                const [primary] = info.preview;
                const label = t(COLOR_THEME_LABEL_KEYS[themeKey]);
                const isActive = colorTheme === themeKey;
                return (
                  <button
                    key={themeKey}
                    type="button"
                    aria-label={label}
                    aria-pressed={isActive}
                    data-theme={themeKey}
                    onClick={() => setColorTheme(themeKey)}
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
