'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PublishConfig {
  enabled: boolean;
  layout: 'list' | 'board';
  visibility: 'public' | 'team-only';
  allowComments: boolean;
  allowReactions: boolean;
  allowVoting: boolean;
  showAttachments: boolean;
  showCycles: boolean;
  showModules: boolean;
  password?: string | null;
}

export interface UseProjectPublishResult {
  config: PublishConfig;
  publicUrl: string;
  updateConfig: (patch: Partial<PublishConfig>) => void;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  copyLink: () => void;
}

const DEFAULT_CONFIG: PublishConfig = {
  enabled: false,
  layout: 'board',
  visibility: 'public',
  allowComments: true,
  allowReactions: true,
  allowVoting: false,
  showAttachments: true,
  showCycles: false,
  showModules: false,
  password: null,
};

const storageKey = (projectId: string): string => `tn:publish-config:${projectId}`;

const isBrowser = (): boolean => typeof window !== 'undefined';

function readFromStorage(projectId: string): PublishConfig {
  if (!isBrowser()) return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<PublishConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    console.warn('[use-project-publish] Failed to read config', err);
    return DEFAULT_CONFIG;
  }
}

function writeToStorage(projectId: string, config: PublishConfig): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(config));
  } catch (err) {
    console.warn('[use-project-publish] Failed to write config', err);
  }
}

export function useProjectPublish(projectId: string): UseProjectPublishResult {
  const [config, setConfig] = useState<PublishConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    setConfig(readFromStorage(projectId));
  }, [projectId]);

  const publicUrl = useMemo(() => {
    if (!isBrowser()) return `/share/p/${projectId}`;
    return `${window.location.origin}/share/p/${projectId}`;
  }, [projectId]);

  const updateConfig = useCallback(
    (patch: Partial<PublishConfig>) => {
      setConfig((prev) => {
        const next: PublishConfig = { ...prev, ...patch };
        writeToStorage(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const publish = useCallback(async (): Promise<void> => {
    setConfig((prev) => {
      const next: PublishConfig = { ...prev, enabled: true };
      writeToStorage(projectId, next);
      console.info('[use-project-publish] publish', { projectId, config: next });
      return next;
    });
  }, [projectId]);

  const unpublish = useCallback(async (): Promise<void> => {
    setConfig((prev) => {
      const next: PublishConfig = { ...prev, enabled: false };
      writeToStorage(projectId, next);
      console.info('[use-project-publish] unpublish', { projectId });
      return next;
    });
  }, [projectId]);

  const copyLink = useCallback((): void => {
    if (!isBrowser()) return;
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(publicUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = publicUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      console.info('[use-project-publish] copied link', publicUrl);
    } catch (err) {
      console.warn('[use-project-publish] copy failed', err);
    }
  }, [publicUrl]);

  return { config, publicUrl, updateConfig, publish, unpublish, copyLink };
}
