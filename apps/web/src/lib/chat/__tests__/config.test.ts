jest.mock('livekit-server-sdk', () => ({
  AccessToken: class {
    addGrant() {}
    async toJwt() {
      return 'test-token';
    }
  },
  RoomServiceClient: class {},
}));

import {
  normalizeProjectCommunicationsSettings,
  normalizeWorkspaceCommunicationsSettings,
  resolveEffectiveProjectCommunicationsSettings,
} from '@/lib/chat/config';
import {
  buildLivekitParticipantIdentity,
  buildLivekitRoomName,
  getLivekitStatus,
  parseLivekitParticipantIdentity,
  resolveLivekitPublicUrl,
} from '@/lib/chat/livekit';

describe('chat config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('normalizes workspace and project communications safely', () => {
    const workspace = normalizeWorkspaceCommunicationsSettings({
      enabled: true,
      voiceEnabled: false,
    });
    const project = normalizeProjectCommunicationsSettings({
      enabled: true,
      inheritWorkspaceDefaults: true,
      unreadTrackingEnabled: false,
    });

    expect(workspace.enabled).toBe(true);
    expect(workspace.voiceEnabled).toBe(false);
    expect(project.inheritWorkspaceDefaults).toBe(true);
    expect(project.unreadTrackingEnabled).toBe(false);
    expect(project.attachmentsEnabled).toBe(true);
  });

  it('intersects workspace and project rules into effective runtime settings', () => {
    const effective = resolveEffectiveProjectCommunicationsSettings(
      normalizeWorkspaceCommunicationsSettings({
        enabled: true,
        voiceEnabled: false,
        documentThreadsEnabled: true,
      }),
      normalizeProjectCommunicationsSettings({
        enabled: true,
        inheritWorkspaceDefaults: true,
        voiceEnabled: true,
        documentThreadsEnabled: false,
      })
    );

    expect(effective.enabled).toBe(true);
    expect(effective.voiceEnabled).toBe(false);
    expect(effective.documentThreadsEnabled).toBe(false);
  });

  it('reports livekit readiness from environment', () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    expect(getLivekitStatus().ready).toBe(false);

    process.env.LIVEKIT_URL = 'http://livekit:7880';
    process.env.NEXT_PUBLIC_LIVEKIT_URL = 'ws://localhost:7880';
    process.env.LIVEKIT_API_KEY = 'devkey';
    process.env.LIVEKIT_API_SECRET = 'secret';

    const status = getLivekitStatus();

    expect(status.ready).toBe(true);
    expect(status.url).toBe('ws://localhost:7880');
    expect(status.missing).toHaveLength(0);
  });

  it('builds unique livekit room names for repeated call sessions', () => {
    const first = buildLivekitRoomName('WEB', 'room-1');
    const second = buildLivekitRoomName('WEB', 'room-1');

    expect(first).toMatch(/^tn-web-room-1-/);
    expect(second).toMatch(/^tn-web-room-1-/);
    expect(first).not.toBe(second);
  });

  it('builds and parses browser-session livekit participant identities', () => {
    const identity = buildLivekitParticipantIdentity('user-1', 'session-abc');
    const parsed = parseLivekitParticipantIdentity(identity);

    expect(identity).toBe('tnp:user-1:session-abc');
    expect(parsed).toEqual({
      participantIdentity: 'tnp:user-1:session-abc',
      userId: 'user-1',
      clientSessionId: 'session-abc',
    });
  });

  it('derives a browser-reachable public url from the incoming request host', () => {
    process.env.LIVEKIT_PORT = '7880';
    delete process.env.LIVEKIT_PUBLIC_HOST;
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;

    const request = {
      url: 'http://localhost:3002/api/conversations/room-1/call/token',
      headers: {
        get(name: string) {
          const normalized = name.toLowerCase();
          if (normalized === 'host') return 'localhost:3002';
          if (normalized === 'x-forwarded-proto') return 'http';
          return null;
        },
      },
    } as unknown as Request;

    expect(resolveLivekitPublicUrl(request)).toBe('ws://localhost:7880');
  });
});
