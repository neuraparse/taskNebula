/**
 * @jest-environment node
 *
 * SAML response signature-verification wrapper tests. The actual XML
 * signature verification is delegated to `samlify` — here we mock samlify
 * to make sure our wrapper:
 *
 *  - builds an SP / IdP pair with the expected entityIDs + binding URLs,
 *  - rejects malformed / signature-mismatch responses (propagates throws),
 *  - parses the extracted NameID + attributes into a clean shape.
 */

jest.mock('samlify', () => {
  const recorded: { lastSp?: unknown; lastIdp?: unknown } = {};
  return {
    __esModule: true,
    __recorded: recorded,
    setSchemaValidator: jest.fn(),
    Constants: {
      namespace: {
        binding: {
          redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        },
      },
    },
    ServiceProvider: jest.fn((conf: unknown) => {
      recorded.lastSp = conf;
      return {
        getMetadata: () => '<EntityDescriptor mock="true" />',
        createLoginRequest: () => ({
          context: 'https://idp.example.com/sso?SAMLRequest=mock',
        }),
        parseLoginResponse: (
          _idp: unknown,
          _binding: string,
          req: { body: { SAMLResponse: string } }
        ) => {
          if (req.body.SAMLResponse === 'TAMPERED') {
            return Promise.reject(new Error('signature mismatch'));
          }
          if (req.body.SAMLResponse === 'NO_NAME_ID') {
            return Promise.resolve({ extract: { attributes: {} } });
          }
          return Promise.resolve({
            extract: {
              nameID: 'alice@example.com',
              attributes: {
                email: 'alice@example.com',
                givenName: 'Alice',
                surname: 'Liddell',
              },
              sessionIndex: 'session-123',
              // The production `parseLoginResponse` now runs
              // `verifyAssertionConstraints` after samlify's parse, so the
              // mocked extract must satisfy Recipient + AudienceRestriction
              // + clock-skew bounds. Dedicated tests for that helper live
              // in saml-constraints.test.ts; here we just want the success
              // path to flow through.
              subjectConfirmation: {
                recipient: 'https://app.example.com/api/auth/saml/acme/callback',
              },
              conditions: {
                audience: 'https://app.example.com/api/auth/saml/acme/metadata.xml',
                notBefore: new Date(Date.now() - 5_000).toISOString(),
                notOnOrAfter: new Date(Date.now() + 60_000).toISOString(),
              },
            },
          });
        },
      };
    }),
    IdentityProvider: jest.fn((conf: unknown) => {
      recorded.lastIdp = conf;
      return { conf };
    }),
  };
});

import {
  buildAuthnRequestUrl,
  getSpMetadataXml,
  parseLoginResponse,
  spEntityId,
  acsUrl,
} from '../saml';
import type { SsoConfig } from '@tasknebula/db';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as samlifyMockNs from 'samlify';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const samlifyMock = samlifyMockNs as unknown as any;

function makeCtx(): {
  config: SsoConfig;
  workspaceSlug: string;
  baseUrl: string;
} {
  return {
    config: {
      id: 'cfg_1',
      workspaceId: 'ws_1',
      provider: 'saml',
      entryPointUrl: 'https://idp.example.com/sso',
      issuer: 'https://idp.example.com',
      cert: '-----BEGIN CERTIFICATE-----\nMIIDmock\n-----END CERTIFICATE-----',
      privateKey: null,
      audience: 'https://app.example.com',
      attributeMap: {},
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SsoConfig,
    workspaceSlug: 'acme',
    baseUrl: 'https://app.example.com',
  };
}

describe('SAML wrapper', () => {
  it('builds SP with the expected entityID + ACS URL', () => {
    const ctx = makeCtx();
    getSpMetadataXml(ctx);
    expect(samlifyMock.__recorded.lastSp.entityID).toBe(spEntityId(ctx.baseUrl, ctx.workspaceSlug));
    expect(samlifyMock.__recorded.lastSp.assertionConsumerService[0].Location).toBe(
      acsUrl(ctx.baseUrl, ctx.workspaceSlug)
    );
  });

  it('builds an AuthnRequest redirect URL', () => {
    const url = buildAuthnRequestUrl(makeCtx());
    expect(url).toContain('idp.example.com');
    expect(url).toContain('SAMLRequest=');
  });

  it('parses a valid SAML response into NameID + attributes', async () => {
    const out = await parseLoginResponse(makeCtx(), 'OK_RESPONSE');
    expect(out.nameId).toBe('alice@example.com');
    expect(out.attributes.email).toBe('alice@example.com');
    expect(out.sessionIndex).toBe('session-123');
  });

  it('rejects a tampered SAML response (signature mismatch)', async () => {
    await expect(parseLoginResponse(makeCtx(), 'TAMPERED')).rejects.toThrow(/signature/i);
  });

  it('rejects a SAML response missing the NameID', async () => {
    await expect(parseLoginResponse(makeCtx(), 'NO_NAME_ID')).rejects.toThrow(/NameID/i);
  });

  it('strips PEM BEGIN/END from the IdP signing cert', () => {
    parseLoginResponse(makeCtx(), 'OK_RESPONSE');
    const signingCert = samlifyMock.__recorded.lastIdp.signingCert;
    expect(signingCert).not.toContain('BEGIN CERTIFICATE');
    expect(signingCert).not.toContain('END CERTIFICATE');
    expect(signingCert).toContain('MIIDmock');
  });
});
