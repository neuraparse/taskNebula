import type { AuthDeepLink, ContentDeepLink } from './deep-links';
import { isAuthDeepLink, isContentDeepLink, parseTaskNebulaDeepLink } from './deep-links';
import { isSameBaseUrl, normalizeBaseUrl } from './server-url';

type AuthIntentDeepLink = Exclude<AuthDeepLink, { kind: 'server' }>;

interface RouteDeepLinkDeps {
  currentServerUrl: string | null;
  connectServer: (url: string) => Promise<void>;
  setPendingAuthIntent: (intent: AuthIntentDeepLink) => void;
  setPendingContentLink: (intent: ContentDeepLink) => void;
  clearPendingAuthIntent?: () => void;
  clearPendingContentLink?: () => void;
}

function intentFromAuthCallbackUrl(
  callbackUrl: string | null | undefined,
  serverUrl: string | null,
) {
  if (!callbackUrl || !serverUrl) return null;

  try {
    const server = new URL(serverUrl);
    const resolved = new URL(callbackUrl, server);
    if (resolved.origin !== server.origin) return null;
    return parseTaskNebulaDeepLink(resolved.toString());
  } catch {
    return null;
  }
}

export async function routeTaskNebulaDeepLink(
  url: string,
  {
    currentServerUrl,
    connectServer,
    setPendingAuthIntent,
    setPendingContentLink,
    clearPendingAuthIntent,
    clearPendingContentLink,
  }: RouteDeepLinkDeps,
): Promise<boolean> {
  const intent = parseTaskNebulaDeepLink(url);
  if (!intent) return false;

  const intentServerUrl = normalizeBaseUrl(intent.serverUrl);
  let clearedStaleIntents = false;
  if (intentServerUrl && !isSameBaseUrl(intentServerUrl, currentServerUrl)) {
    try {
      await connectServer(intentServerUrl);
      clearPendingAuthIntent?.();
      clearPendingContentLink?.();
      clearedStaleIntents = true;
    } catch {
      return false;
    }
  }

  if (intent.kind === 'server') {
    if (!clearedStaleIntents) {
      clearPendingAuthIntent?.();
      clearPendingContentLink?.();
    }
    return true;
  }
  if (isAuthDeepLink(intent)) {
    if (!clearedStaleIntents) clearPendingContentLink?.();
    setPendingAuthIntent(intent);
    return true;
  }

  if (!clearedStaleIntents) clearPendingAuthIntent?.();
  setPendingContentLink(intent);
  return true;
}

export function contentIntentFromAuthCallbackUrl(
  callbackUrl: string | null | undefined,
  serverUrl: string | null,
): ContentDeepLink | null {
  const intent = intentFromAuthCallbackUrl(callbackUrl, serverUrl);
  return isContentDeepLink(intent) ? intent : null;
}

export function contentIntentFromAuthenticatedAuthIntent(
  intent: AuthIntentDeepLink,
  serverUrl: string | null,
): ContentDeepLink | null {
  if (intent.kind !== 'signin') return null;
  if (intent.projectInviteToken) return null;

  if (intent.callbackUrl) {
    return contentIntentFromAuthCallbackUrl(intent.callbackUrl, serverUrl);
  }

  if (intent.signinStatus === 'verified') {
    const intentServerUrl = normalizeBaseUrl(intent.serverUrl) ?? normalizeBaseUrl(serverUrl);
    return {
      kind: 'tab',
      rawUrl: intent.rawUrl,
      ...(intentServerUrl ? { serverUrl: intentServerUrl } : {}),
      tab: 'Dashboard',
      dashboardNotice: 'emailVerified',
    };
  }

  return null;
}

export type PostAuthCallbackIntent =
  | {
      kind: 'content';
      intent: ContentDeepLink;
    }
  | {
      kind: 'project-invite';
      intent: AuthIntentDeepLink;
    };

export function postAuthIntentFromCallbackUrl(
  callbackUrl: string | null | undefined,
  serverUrl: string | null,
): PostAuthCallbackIntent | null {
  const projectInviteIntent = projectInviteIntentFromAuthCallbackUrl(callbackUrl, serverUrl);
  if (projectInviteIntent) return { kind: 'project-invite', intent: projectInviteIntent };

  const contentIntent = contentIntentFromAuthCallbackUrl(callbackUrl, serverUrl);
  if (contentIntent) return { kind: 'content', intent: contentIntent };

  return null;
}

export function projectInviteIntentFromAuthCallbackUrl(
  callbackUrl: string | null | undefined,
  serverUrl: string | null,
): AuthIntentDeepLink | null {
  const intent = intentFromAuthCallbackUrl(callbackUrl, serverUrl);
  if ((intent?.kind === 'signup' || intent?.kind === 'signin') && intent.projectInviteToken) {
    return intent;
  }
  return null;
}
