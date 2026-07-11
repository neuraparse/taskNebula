import {
  createConversationCallToken,
  createConversationMessage,
  createProjectChatChannel,
  deleteConversationMessage,
  deleteProjectChatChannel,
  endConversationCall,
  getProjectChatBootstrap,
  getProjectCommunicationsSettings,
  leaveConversationCall,
  listConversationMessages,
  listLiveCalls,
  markConversationRead,
  pulseConversationCall,
  startConversationCall,
  updateConversationMessage,
  updateProjectChatChannel,
  updateProjectCommunicationsSettings,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('project chat API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads and normalizes project chat bootstrap data', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
        effectiveSettings: { enabled: true, unreadTrackingEnabled: true },
        permissions: { canBrowseChat: true, canPostMessages: true },
        channels: [
          {
            id: 'channel_1',
            name: 'General',
            slug: 'general',
            description: null,
            roomId: 'room_1',
            unreadCount: '3',
            participantCount: '2',
            lastMessage: {
              id: 'message_1',
              body: 'Ship mobile chat',
              createdAt: '2026-06-28T10:00:00.000Z',
            },
            activeCall: { id: 'call_1', participantCount: '4' },
          },
          { id: 'missing-name' },
        ],
        recentDiscussions: [
          {
            id: 'room_2',
            kind: 'issue_thread',
            title: 'MOB-1',
            unreadCount: 1,
            participantCount: 0,
            latestMessage: null,
            context: { key: 'MOB-1' },
          },
        ],
        activeCalls: [{ id: 'call_1', roomId: 'room_1', participantCount: '4' }],
        lastActiveRoomId: 'room_1',
      }),
    );

    await expect(getProjectChatBootstrap('project_1')).resolves.toMatchObject({
      project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
      effectiveSettings: {
        enabled: true,
        voiceEnabled: false,
        issueThreadsEnabled: true,
        documentThreadsEnabled: true,
        attachmentsEnabled: false,
        unreadTrackingEnabled: true,
      },
      permissions: {
        canBrowseChat: true,
        canPostMessages: true,
        canCreateChannels: false,
      },
      channels: [
        {
          id: 'channel_1',
          roomId: 'room_1',
          unreadCount: 3,
          participantCount: 2,
          lastMessage: {
            id: 'message_1',
            body: 'Ship mobile chat',
            createdAt: '2026-06-28T10:00:00.000Z',
          },
          activeCall: { id: 'call_1', participantCount: 4 },
        },
      ],
      recentDiscussions: [{ id: 'room_2', unreadCount: 1, context: { key: 'MOB-1' } }],
      activeCalls: [{ id: 'call_1', roomId: 'room_1', participantCount: 4 }],
      lastActiveRoomId: 'room_1',
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/chat/bootstrap',
    );
  });

  it('loads and updates project communications settings', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
          access: { canView: true, canManage: true },
          workspaceSettings: { enabled: true, voiceEnabled: false },
          projectSettings: { enabled: true, inheritWorkspaceDefaults: false },
          effectiveSettings: { enabled: true, voiceEnabled: true, attachmentsEnabled: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectSettings: {
            enabled: false,
            inheritWorkspaceDefaults: false,
            voiceEnabled: true,
          },
        }),
      );

    await expect(getProjectCommunicationsSettings('project_1')).resolves.toMatchObject({
      project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
      access: { canView: true, canManage: true },
      workspaceSettings: {
        enabled: true,
        voiceEnabled: false,
        issueThreadsEnabled: true,
        documentThreadsEnabled: true,
        attachmentsEnabled: true,
        unreadTrackingEnabled: true,
      },
      projectSettings: {
        enabled: true,
        inheritWorkspaceDefaults: false,
        voiceEnabled: true,
        attachmentsEnabled: true,
      },
      effectiveSettings: {
        enabled: true,
        voiceEnabled: true,
        attachmentsEnabled: true,
      },
    });

    await expect(
      updateProjectCommunicationsSettings('project_1', {
        enabled: false,
        inheritWorkspaceDefaults: false,
      }),
    ).resolves.toMatchObject({
      enabled: false,
      inheritWorkspaceDefaults: false,
      voiceEnabled: true,
    });

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/communications');
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/communications');
    expect(calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      enabled: false,
      inheritWorkspaceDefaults: false,
    });
  });

  it('lists messages and sends message mutations to conversation endpoints', async () => {
    const message = {
      id: 'message_1',
      roomId: 'room_1',
      body: 'Hello team',
      attachments: [{ id: 'file_1', fileName: 'spec.md', fileSize: '42' }],
      mentions: ['user_2'],
      deletedAt: null,
      editedAt: null,
      createdAt: '2026-06-28T10:00:00.000Z',
      author: { id: 'user_1', name: 'Ada', email: 'ada@example.com', image: null },
      canDelete: true,
      canEdit: true,
      moderation: null,
      reactions: [
        { emoji: '👍', count: '2', reactedUserIds: ['user_1'], reactedByCurrentUser: true },
      ],
    };

    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          messages: [message, { id: 'missing-room' }],
          pageInfo: { hasMore: true, nextCursor: 'message_0' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { message }))
      .mockResolvedValueOnce(jsonResponse(200, { message: { ...message, body: 'Updated' } }))
      .mockResolvedValueOnce(jsonResponse(200, { message: { ...message, deletedAt: 'now' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await expect(
      listConversationMessages({ roomId: 'room_1', before: 'message_0', limit: 40 }),
    ).resolves.toEqual({
      messages: [
        {
          id: 'message_1',
          roomId: 'room_1',
          body: 'Hello team',
          attachments: [
            {
              id: 'file_1',
              fileName: 'spec.md',
              fileSize: 42,
              mimeType: 'application/octet-stream',
              filePath: '',
              uploadedById: '',
              uploadedAt: '',
            },
          ],
          mentions: ['user_2'],
          deletedAt: null,
          editedAt: null,
          createdAt: '2026-06-28T10:00:00.000Z',
          author: { id: 'user_1', name: 'Ada', email: 'ada@example.com', image: null },
          canDelete: true,
          canEdit: true,
          moderation: null,
          reactions: [
            {
              emoji: '👍',
              count: 2,
              reactedUserIds: ['user_1'],
              reactedByCurrentUser: true,
            },
          ],
        },
      ],
      pageInfo: { hasMore: true, nextCursor: 'message_0' },
    });
    await createConversationMessage('room_1', { body: 'Hello team' });
    await updateConversationMessage('room_1', 'message_1', { reactionEmoji: '👍' });
    await deleteConversationMessage('room_1', 'message_1');
    await markConversationRead('room_1', 'message_1');

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/conversations/room_1/messages?before=message_0&limit=40',
    );
    expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[1]?.[1]?.body))).toEqual({
      body: 'Hello team',
      parentMessageId: null,
    });
    expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[2]?.[1]?.body))).toEqual({
      reactionEmoji: '👍',
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[3]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[4]?.[1]?.body))).toEqual({
      lastReadMessageId: 'message_1',
    });
  });

  it('creates, updates, and archives project chat channels', async () => {
    const channel = {
      id: 'channel_1',
      name: 'Release',
      slug: 'release',
      description: 'Release lane',
      isDefault: false,
    };

    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { channel, room: { id: 'room_1' } }))
      .mockResolvedValueOnce(
        jsonResponse(200, { channel: { ...channel, name: 'Launch' }, room: { id: 'room_1' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createProjectChatChannel('project_1', { name: 'Release', description: 'Release lane' });
    await updateProjectChatChannel('project_1', 'channel_1', { name: 'Launch' });
    await deleteProjectChatChannel('project_1', 'channel_1');

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/channels',
    );
    expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body))).toEqual({
      name: 'Release',
      description: 'Release lane',
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/channels/channel_1',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('manages conversation call lifecycle endpoints', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          call: {
            id: 'call_1',
            roomId: 'room_1',
            participantCount: '1',
            livekitRoomName: 'tasknebula_MOB_room_1',
          },
          livekit: { ready: true, url: 'wss://livekit.example.com', missing: [] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          participantIdentity: 'tnp:user_1:session_1',
          roomName: 'tasknebula_MOB_room_1',
          token: 'token_1',
          url: 'wss://livekit.example.com',
          call: {
            id: 'call_1',
            roomId: 'room_1',
            participantCount: '2',
            livekitRoomName: 'tasknebula_MOB_room_1',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          call: { id: 'call_1', roomId: 'room_1', participantCount: '1' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          result: {
            callId: 'call_1',
            roomId: 'room_1',
            touchedAt: '2026-06-29T10:00:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await expect(startConversationCall('room_1')).resolves.toMatchObject({
      call: {
        id: 'call_1',
        roomId: 'room_1',
        participantCount: 1,
        livekitRoomName: 'tasknebula_MOB_room_1',
      },
      livekit: { ready: true, url: 'wss://livekit.example.com', missing: [] },
    });
    await expect(
      createConversationCallToken('room_1', { clientSessionId: 'session_1' }),
    ).resolves.toMatchObject({
      participantIdentity: 'tnp:user_1:session_1',
      roomName: 'tasknebula_MOB_room_1',
      token: 'token_1',
      url: 'wss://livekit.example.com',
      call: { id: 'call_1', participantCount: 2 },
    });
    await expect(
      leaveConversationCall('room_1', { participantIdentity: 'tnp:user_1:session_1' }),
    ).resolves.toMatchObject({
      success: true,
      call: { id: 'call_1', participantCount: 1 },
    });
    await expect(
      pulseConversationCall('room_1', { participantIdentity: 'tnp:user_1:session_1' }),
    ).resolves.toMatchObject({
      success: true,
      result: {
        callId: 'call_1',
        roomId: 'room_1',
        touchedAt: '2026-06-29T10:00:00.000Z',
      },
    });
    await endConversationCall('room_1');

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/conversations/room_1/call/start');
    expect(calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/conversations/room_1/call/token');
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ clientSessionId: 'session_1' });
    expect(calls[2]?.[0]).toBe('https://tasks.example.com/api/conversations/room_1/call/leave');
    expect(JSON.parse(String(calls[2]?.[1]?.body))).toEqual({
      participantIdentity: 'tnp:user_1:session_1',
    });
    expect(calls[3]?.[0]).toBe('https://tasks.example.com/api/conversations/room_1/call/pulse');
    expect(JSON.parse(String(calls[3]?.[1]?.body))).toEqual({
      participantIdentity: 'tnp:user_1:session_1',
    });
    expect(calls[4]?.[0]).toBe('https://tasks.example.com/api/conversations/room_1/call/end');
    expect(calls[4]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('lists globally accessible live calls', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        calls: [
          {
            id: 'call_1',
            roomId: 'room_1',
            livekitRoomName: 'tasknebula_MOB_room_1',
            participantCount: '3',
            startedAt: '2026-06-29T10:00:00.000Z',
            joinedParticipantId: 'participant_1',
            isParticipant: true,
            project: {
              id: 'project_1',
              key: 'MOB',
              name: 'Mobile',
              path: 'mob',
            },
            room: {
              id: 'room_1',
              kind: 'channel',
              title: 'General',
              subtitle: 'Project channel',
              href: '/projects/mob/chat?roomId=room_1',
            },
          },
          { id: 'missing-room' },
        ],
      }),
    );

    await expect(listLiveCalls()).resolves.toEqual([
      {
        id: 'call_1',
        roomId: 'room_1',
        livekitRoomName: 'tasknebula_MOB_room_1',
        participantCount: 3,
        startedAt: '2026-06-29T10:00:00.000Z',
        joinedParticipantId: 'participant_1',
        isParticipant: true,
        project: {
          id: 'project_1',
          key: 'MOB',
          name: 'Mobile',
          path: 'mob',
        },
        room: {
          id: 'room_1',
          kind: 'channel',
          title: 'General',
          subtitle: 'Project channel',
          href: '/projects/mob/chat?roomId=room_1',
        },
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/chat/live-calls',
    );
  });
});
