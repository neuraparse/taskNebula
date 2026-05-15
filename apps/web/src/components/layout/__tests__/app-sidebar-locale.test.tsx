// The sidebar imports a wide React + Next.js dependency tree (next-auth,
// livekit, etc.) that JSDOM/Jest cannot evaluate without help. We only care
// about the pure helpers re-exported from `__test__`, so stub the heavy
// integration points before importing the module.

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

jest.mock('@livekit/components-react', () => ({
  RoomContext: { Provider: ({ children }: { children: unknown }) => children },
  useAudioPlayback: () => ({ canPlayAudio: true, startAudio: jest.fn() }),
  useConnectionState: () => 'disconnected',
  useIsSpeaking: () => false,
  useLocalParticipant: () => ({ localParticipant: null }),
  useParticipants: () => [],
  useRoomContext: () => ({}),
}));

jest.mock('@/lib/hooks/use-organization', () => ({ useOrganization: () => ({}) }));
jest.mock('@/lib/hooks/use-projects', () => ({ useProjects: () => ({ data: [] }) }));
jest.mock('@/lib/hooks/use-chat', () => ({ useLiveCalls: () => ({ data: [] }) }));
jest.mock('@/components/chat/global-voice-provider', () => ({ useGlobalVoice: () => ({}) }));
jest.mock('@/lib/chat/voice-preferences', () => ({ useStoredVoicePreferences: () => ({}) }));
jest.mock('@/components/layout/page-sidebar-slot', () => ({
  PageSidebarSlotTarget: () => null,
  usePageSidebarHasContent: () => false,
}));
jest.mock('@/components/layout/app-rail', () => ({ AppRail: () => null }));
jest.mock('@/components/organization/teamspace-switcher', () => ({
  TeamspaceSwitcher: () => null,
}));
jest.mock('@/components/branding/tasknebula-logo', () => ({ TaskNebulaLogo: () => null }));

import { __test__ } from '../app-sidebar';

const { stripLocalePrefix, getSectionKey } = __test__;

// The sidebar's section highlighting must work regardless of which locale
// prefix next-intl injected into the URL. These tests pin down the pure
// path-mapping helpers so regressions in the locale stripping or section
// routing show up immediately.

describe('stripLocalePrefix', () => {
  it('strips a 2-char locale prefix followed by a sub-path', () => {
    expect(stripLocalePrefix('/tr/projects/abc')).toBe('/projects/abc');
  });

  it('returns a non-prefixed path unchanged', () => {
    expect(stripLocalePrefix('/projects')).toBe('/projects');
  });

  it('returns "/" for the root path', () => {
    expect(stripLocalePrefix('/')).toBe('/');
  });

  it('returns "/" when given null', () => {
    expect(stripLocalePrefix(null)).toBe('/');
  });

  it('returns "/" when given undefined', () => {
    expect(stripLocalePrefix(undefined)).toBe('/');
  });

  it('does not strip when the 2-char prefix is not followed by "/" or end (e.g. /api-docs)', () => {
    // Regex is /^\/[a-z]{2}(?=\/|$)/ — the lookahead requires the boundary to
    // be a slash or end-of-string. In `/api-docs` the third character is `i`,
    // so `ap` is *not* a locale and the path must be returned untouched.
    expect(stripLocalePrefix('/api-docs')).toBe('/api-docs');
  });

  it('strips a bare locale prefix down to "/"', () => {
    expect(stripLocalePrefix('/tr')).toBe('/');
  });
});

describe('getSectionKey', () => {
  it('maps /tr/inbox to "my_issues" (inbox lives in the My Issues section)', () => {
    expect(getSectionKey('/tr/inbox')).toBe('my_issues');
  });

  it('maps /de/initiatives to "projects"', () => {
    expect(getSectionKey('/de/initiatives')).toBe('projects');
  });

  it('maps /es/settings/intake-forms to "settings"', () => {
    expect(getSectionKey('/es/settings/intake-forms')).toBe('settings');
  });

  it('maps /en/my-issues to "my_issues"', () => {
    expect(getSectionKey('/en/my-issues')).toBe('my_issues');
  });

  it('falls back to "dashboard" for unknown paths', () => {
    expect(getSectionKey('/fr/totally-unknown')).toBe('dashboard');
  });

  it('maps the root path to "dashboard"', () => {
    expect(getSectionKey('/')).toBe('dashboard');
  });
});
