/**
 * @jest-environment node
 */

const isSuperAdminMock = jest.fn();
jest.mock('@/lib/auth/permissions', () => ({
  isSuperAdmin: (...args: unknown[]) => isSuperAdminMock(...args),
}));

const previewBuiltinKeys = [
  'issue_assigned',
  'issue_mentioned',
  'issue_commented',
  'issue_status_changed',
  'issue_created',
  'sprint_started',
  'sprint_completed',
  'project_created',
  'project_archived',
  'daily_digest',
  'weekly_digest',
] as const;

jest.mock('@tasknebula/db', () => ({
  BUILTIN_TEMPLATES: Object.fromEntries(
    [
      'issue_assigned',
      'issue_mentioned',
      'issue_commented',
      'issue_status_changed',
      'issue_created',
      'sprint_started',
      'sprint_completed',
      'project_created',
      'project_archived',
      'daily_digest',
      'weekly_digest',
    ].map((key) => [
      key,
      {
        subject: key,
        html: `<html><body data-template="${key}">{{issueTitle}}</body></html>`,
        text: key,
      },
    ])
  ),
  replaceVariables: (template: string, variables: Record<string, string>) =>
    template.replace(/{{(.*?)}}/g, (_match, key: string) => variables[key] ?? ''),
}));

jest.mock('@/lib/auth/email-verification', () => ({
  renderVerifyEmailMessage: () => ({
    subject: 'Verify',
    html: '<html><body data-template="verify_email">Verify</body></html>',
    text: 'Verify',
  }),
}));

jest.mock('@/lib/email/templates', () => ({
  renderInvitationMessage: () => ({
    subject: 'Invite',
    html: '<html><body data-template="invitation">Invite</body></html>',
    text: 'Invite',
  }),
  renderPasswordResetMessage: () => ({
    subject: 'Reset',
    html: '<html><body data-template="password_reset">Reset</body></html>',
    text: 'Reset',
  }),
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';

function request(template?: string) {
  const url = new URL('http://localhost/api/admin/email-preview');
  if (template) url.searchParams.set('template', template);
  return new NextRequest(url);
}

describe('GET /api/admin/email-preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires super-admin access', async () => {
    isSuperAdminMock.mockResolvedValue(false);

    const res = await GET(request('verify_email'));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Super admin access required' });
  });

  it('returns the full supported preview key list for missing template requests', async () => {
    isSuperAdminMock.mockResolvedValue(true);

    const res = await GET(request());
    const body = (await res.json()) as { supported: string[] };

    expect(res.status).toBe(400);
    expect(body.supported).toEqual([
      'verify_email',
      'password_reset',
      'invitation',
      ...previewBuiltinKeys,
    ]);
  });

  it.each([
    'issue_status_changed',
    'issue_created',
    'sprint_completed',
    'project_created',
    'project_archived',
  ])('renders the %s preview', async (template) => {
    isSuperAdminMock.mockResolvedValue(true);

    const res = await GET(request(template));
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain(`data-template="${template}"`);
    expect(html).toContain('Flaky login redirect on Safari iOS');
  });
});
