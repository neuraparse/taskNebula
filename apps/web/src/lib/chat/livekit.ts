import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createId } from '@paralleldrive/cuid2';
import { resolveLivekitConfig } from '@/lib/admin/system-settings';

const PARTICIPANT_IDENTITY_PREFIX = 'tnp';

function stripPort(host: string) {
  if (host.startsWith('[')) {
    const closing = host.indexOf(']');
    return closing >= 0 ? host.slice(0, closing + 1) : host;
  }

  return host.split(':')[0] || host;
}

export function resolveLivekitPublicUrl(request?: Request) {
  const configuredPublicHost = process.env.LIVEKIT_PUBLIC_HOST?.trim();
  const configuredPort = process.env.LIVEKIT_PORT || '7880';
  const configuredPublicUrl = (process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || '').trim();

  const buildSocketUrl = (host: string, protocolHint?: string) => {
    const socketProtocol = protocolHint === 'https' || protocolHint === 'wss' ? 'wss' : 'ws';
    return `${socketProtocol}://${host}:${configuredPort}`;
  };

  // If NEXT_PUBLIC_LIVEKIT_URL is a fully-qualified ws:// / wss:// URL it
  // wins outright — this is the production path where an nginx proxy
  // terminates TLS on a dedicated subdomain (e.g. wss://livekit.example.com)
  // and the port is 443, not 7880. Falling through to LIVEKIT_PUBLIC_HOST
  // here would silently replace that with a port-7880 URL that the
  // browser can't reach.
  if (
    configuredPublicUrl.startsWith('wss://') ||
    configuredPublicUrl.startsWith('ws://')
  ) {
    return configuredPublicUrl.replace(/\/+$/, '');
  }

  if (configuredPublicHost) {
    const protocolHint =
      configuredPublicUrl.startsWith('https://') || configuredPublicUrl.startsWith('wss://')
        ? 'https'
        : configuredPublicUrl.startsWith('http://') || configuredPublicUrl.startsWith('ws://')
          ? 'http'
          : undefined;
    return buildSocketUrl(configuredPublicHost, protocolHint);
  }

  if (request) {
    const requestUrl = new URL(request.url);
    const forwardedProto =
      request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '');
    const forwardedHost =
      request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host;
    return buildSocketUrl(stripPort(forwardedHost), forwardedProto);
  }

  return configuredPublicUrl;
}

export function getLivekitConfig() {
  return {
    serverUrl: process.env.LIVEKIT_URL || '',
    publicUrl: resolveLivekitPublicUrl() || process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  };
}

/**
 * DB-first LiveKit config resolver. Prefers the Admin → System → LiveKit
 * values when present, falls back to env vars. Use from async server code
 * (API routes, server actions). The synchronous `getLivekitConfig()` above
 * stays env-only — it's only used by code paths that need a sync read
 * (status surface, webhook verification).
 */
export async function resolveLivekitConfigForServer() {
  const db = await resolveLivekitConfig();
  if (db) {
    const publicUrl = resolveLivekitPublicUrl() || db.url;
    return {
      serverUrl: db.url,
      publicUrl,
      apiKey: db.apiKey,
      apiSecret: db.apiSecret,
      source: db.source,
    };
  }
  const env = getLivekitConfig();
  return {
    serverUrl: env.serverUrl,
    publicUrl: env.publicUrl,
    apiKey: env.apiKey,
    apiSecret: env.apiSecret,
    source: 'env' as const,
  };
}

export function getLivekitStatus() {
  const config = getLivekitConfig();
  const ready = Boolean(config.serverUrl && config.publicUrl && config.apiKey && config.apiSecret);

  return {
    ready,
    url: config.publicUrl || null,
    missing: [
      !config.serverUrl ? 'LIVEKIT_URL' : null,
      !config.publicUrl ? 'NEXT_PUBLIC_LIVEKIT_URL' : null,
      !config.apiKey ? 'LIVEKIT_API_KEY' : null,
      !config.apiSecret ? 'LIVEKIT_API_SECRET' : null,
    ].filter(Boolean),
  };
}

export async function createLivekitRoomService() {
  const config = await resolveLivekitConfigForServer();
  if (!config.serverUrl || !config.apiKey || !config.apiSecret) {
    return null;
  }

  return new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret);
}

export function buildLivekitRoomName(projectKey: string, roomId: string) {
  return `tn-${projectKey.toLowerCase()}-${roomId}-${createId()}`;
}

export function buildLivekitParticipantIdentity(userId: string, clientSessionId: string) {
  return `${PARTICIPANT_IDENTITY_PREFIX}:${userId}:${clientSessionId}`;
}

export function parseLivekitParticipantIdentity(identity: string | null | undefined) {
  const trimmed = identity?.trim();
  if (!trimmed) {
    return {
      participantIdentity: null,
      userId: null,
      clientSessionId: null,
    };
  }

  if (!trimmed.startsWith(`${PARTICIPANT_IDENTITY_PREFIX}:`)) {
    return {
      participantIdentity: trimmed,
      userId: trimmed,
      clientSessionId: null,
    };
  }

  const [, userId, ...sessionParts] = trimmed.split(':');
  const clientSessionId = sessionParts.join(':') || null;

  return {
    participantIdentity: trimmed,
    userId: userId || null,
    clientSessionId,
  };
}

export async function createLivekitToken(params: {
  roomName: string;
  identity: string;
  name: string;
  metadata?: string;
  publicUrlOverride?: string;
}) {
  const config = await resolveLivekitConfigForServer();
  const publicUrl = params.publicUrlOverride || config.publicUrl;
  if (!config.serverUrl || !publicUrl || !config.apiKey || !config.apiSecret) {
    throw new Error('LiveKit is not configured');
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: params.identity,
    name: params.name,
    metadata: params.metadata,
  });

  token.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return {
    url: publicUrl,
    token: await token.toJwt(),
  };
}
