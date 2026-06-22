'use client';

import { useEffect } from 'react';

const STALE_DEPLOYMENT_RELOAD_KEY = 'tasknebula:stale-deployment-reload-at';
const RELOAD_THROTTLE_MS = 30_000;
const TASKNEBULA_CACHE_PREFIX = 'tasknebula-';

const STALE_DEPLOYMENT_PATTERNS = [
  'Failed to find Server Action',
  'older or newer deployment',
  'ChunkLoadError',
  'Loading chunk',
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'CSS_CHUNK_LOAD_FAILED',
];

export const deploymentReloadInternals = {
  reload: () => window.location.reload(),
};

export function isStaleDeploymentMessage(value: unknown): boolean {
  if (value instanceof Error) {
    return isStaleDeploymentMessage(value.message) || isStaleDeploymentMessage(value.stack);
  }

  if (typeof value !== 'string') {
    return false;
  }

  return STALE_DEPLOYMENT_PATTERNS.some((pattern) => value.includes(pattern));
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

async function clearTaskNebulaRuntimeState() {
  const tasks: Array<Promise<unknown>> = [];

  if ('caches' in window) {
    tasks.push(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(TASKNEBULA_CACHE_PREFIX))
              .map((key) => caches.delete(key))
          )
        )
    );
  }

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.update()))
        )
    );
  }

  await Promise.allSettled(tasks);
}

function reloadOnceForStaleDeployment() {
  const now = Date.now();

  try {
    const previousReloadAt = Number(sessionStorage.getItem(STALE_DEPLOYMENT_RELOAD_KEY) || 0);
    if (now - previousReloadAt < RELOAD_THROTTLE_MS) {
      return;
    }
    sessionStorage.setItem(STALE_DEPLOYMENT_RELOAD_KEY, String(now));
  } catch {
    // Session storage can be unavailable in hardened browser modes.
  }

  clearTaskNebulaRuntimeState()
    .catch(() => undefined)
    .finally(() => {
      deploymentReloadInternals.reload();
    });
}

export function DeploymentReloadGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;

    const wrappedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);
      const method = getRequestMethod(args[0], args[1]);

      if (method !== 'GET' && response.status >= 400) {
        const body = await response
          .clone()
          .text()
          .catch(() => '');

        if (isStaleDeploymentMessage(body)) {
          reloadOnceForStaleDeployment();
        }
      }

      return response;
    };

    const handleError = (event: ErrorEvent) => {
      if (isStaleDeploymentMessage(event.error) || isStaleDeploymentMessage(event.message)) {
        reloadOnceForStaleDeployment();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isStaleDeploymentMessage(event.reason)) {
        reloadOnceForStaleDeployment();
      }
    };

    window.fetch = wrappedFetch;
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      if (window.fetch === wrappedFetch) {
        window.fetch = originalFetch;
      }
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
