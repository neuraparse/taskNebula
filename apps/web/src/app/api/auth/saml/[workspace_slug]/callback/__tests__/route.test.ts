/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const loadSsoForSlugMock = jest.fn();
const parseLoginResponseMock = jest.fn();
const resolveUserAttributesMock = jest.fn();
const jitProvisionUserMock = jest.fn();
const mintSamlExchangeTokenMock = jest.fn();
const verifyRelayStateMock = jest.fn();
const isMobileRelayStateMock = jest.fn();
const getMobileRelayStateCallbackUrlMock = jest.fn();

jest.mock('@/lib/sso/workspace', () => ({
  loadSsoForSlug: (...args: unknown[]) => loadSsoForSlugMock(...args),
}));

jest.mock('@/lib/sso/saml', () => ({
  getBaseUrl: () => 'https://tasks.example.com',
  parseLoginResponse: (...args: unknown[]) => parseLoginResponseMock(...args),
}));

jest.mock('@/lib/sso/attribute-map', () => ({
  resolveUserAttributes: (...args: unknown[]) => resolveUserAttributesMock(...args),
}));

jest.mock('@/lib/sso/jit', () => ({
  jitProvisionUser: (...args: unknown[]) => jitProvisionUserMock(...args),
}));

jest.mock('@/lib/sso/session', () => ({
  mintSamlExchangeToken: (...args: unknown[]) => mintSamlExchangeTokenMock(...args),
}));

jest.mock('@/lib/sso/relay-state', () => ({
  verifyRelayState: (...args: unknown[]) => verifyRelayStateMock(...args),
  isMobileRelayState: (...args: unknown[]) => isMobileRelayStateMock(...args),
  getMobileRelayStateCallbackUrl: (...args: unknown[]) =>
    getMobileRelayStateCallbackUrlMock(...args),
}));

import { POST } from '../route';

function samlRequest() {
  const formData = new FormData();
  formData.set('SAMLResponse', 'signed-saml-response');
  formData.set('RelayState', 'mobile-relay');
  return new NextRequest('https://tasks.example.com/api/auth/saml/acme/callback', {
    method: 'POST',
    body: formData,
  });
}

describe('/api/auth/saml/[workspace_slug]/callback mobile relay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadSsoForSlugMock.mockResolvedValue({
      workspaceId: 'org_1',
      workspaceSlug: 'acme',
      config: {
        enabled: true,
        provider: 'saml',
        attributeMap: {},
      },
    });
    verifyRelayStateMock.mockReturnValue({ ok: true, slug: 'acme' });
    isMobileRelayStateMock.mockReturnValue(true);
    getMobileRelayStateCallbackUrlMock.mockReturnValue('/settings/sso');
    parseLoginResponseMock.mockResolvedValue({ nameID: 'user@example.com' });
    resolveUserAttributesMock.mockReturnValue({
      email: 'user@example.com',
      firstName: 'User',
      lastName: 'Example',
      groups: ['Engineering'],
    });
    jitProvisionUserMock.mockResolvedValue({ userId: 'user_1' });
    mintSamlExchangeTokenMock.mockResolvedValue('saml-exchange-token');
  });

  it('returns a native callback when RelayState marks the flow as mobile', async () => {
    const response = await POST(samlRequest(), {
      params: Promise.resolve({ workspace_slug: 'acme' }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'tasknebula://auth/saml?status=authenticated&server=https%3A%2F%2Ftasks.example.com&workspace=acme&token=saml-exchange-token&callbackUrl=%2Fsettings%2Fsso'
    );
    expect(mintSamlExchangeTokenMock).toHaveBeenCalledWith({
      userId: 'user_1',
      email: 'user@example.com',
      workspaceId: 'org_1',
    });
  });
});
