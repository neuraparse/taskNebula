'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { MicrophoneMessageCatalog } from '@/lib/chat/microphone';

export function useMicrophoneMessageCatalog() {
  const t = useTranslations('workspaceTools');

  return useMemo<MicrophoneMessageCatalog>(
    () => ({
      recoveryHint: {
        chromium: t('chat.voice.microphoneRecoveryHint.chromium'),
        edge: t('chat.voice.microphoneRecoveryHint.edge'),
        firefox: t('chat.voice.microphoneRecoveryHint.firefox'),
        safari: t('chat.voice.microphoneRecoveryHint.safari'),
        unknown: t('chat.voice.microphoneRecoveryHint.unknown'),
      },
      pendingJoin: ({ hint }) => t('chat.voice.pendingMicrophoneJoin', { hint }),
      pendingRuntime: ({ hint }) => t('chat.voice.pendingMicrophoneRuntime', { hint }),
      timedOutAccess: ({ hint }) => t('chat.voice.timedOutMicrophoneAccess', { hint }),
      timedOutPendingPrompt: ({ hint }) =>
        t('chat.voice.timedOutPendingMicrophonePrompt', { hint }),
      deniedAccess: ({ hint }) => t('chat.voice.deniedMicrophoneAccess', { hint }),
      captureUnsupported: t('chat.voice.microphoneCaptureUnsupported'),
      audioEngineFailed: t('chat.voice.audioEngineFailed'),
      microphoneNotFound: t('chat.voice.microphoneNotFound'),
      microphoneBusy: t('chat.voice.microphoneBusy'),
      accessUnavailable: ({ hint }) => t('chat.voice.microphoneAccessUnavailable', { hint }),
      permissionState: {
        allowed: t('chat.voice.permissionStateLabel.allowed'),
        blocked: t('chat.voice.permissionStateLabel.blocked'),
        waitingForBrowserDecision: t('chat.voice.permissionStateLabel.waitingForBrowserDecision'),
        browserManaged: t('chat.voice.permissionStateLabel.browserManaged'),
      },
      permissionHelp: {
        deviceLabelsHiddenUntilPermission: t(
          'chat.voice.permissionHelp.deviceLabelsHiddenUntilPermission'
        ),
        grantedWithDevicesAndLabels: t('chat.voice.permissionHelp.grantedWithDevicesAndLabels'),
        grantedLabelsHidden: t('chat.voice.permissionHelp.grantedLabelsHidden'),
        grantedNoDevices: t('chat.voice.permissionHelp.grantedNoDevices'),
        denied: ({ hint }) => t('chat.voice.permissionHelp.denied', { hint }),
        prompt: ({ hint, labelsHiddenNote }) =>
          t('chat.voice.permissionHelp.prompt', {
            hint,
            labelsHiddenNote: labelsHiddenNote ? ` ${labelsHiddenNote}` : '',
          }),
        unknown: ({ hint, labelsHiddenNote }) =>
          t('chat.voice.permissionHelp.unknown', {
            hint,
            labelsHiddenNote: labelsHiddenNote ? ` ${labelsHiddenNote}` : '',
          }),
      },
    }),
    [t]
  );
}
