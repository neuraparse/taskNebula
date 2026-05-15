/**
 * @jest-environment node
 *
 * Unit tests for the SAML defence-in-depth checks added in
 * `apps/web/src/lib/sso/saml.ts`:
 *
 *   1. The schema validator registered with samlify — guards against
 *      empty payloads, XXE vectors (`<!DOCTYPE`, `<!ENTITY`),
 *      signature-wrapping (>1 `<Response>` / `<Assertion>` element) and
 *      oversized payloads (>3 MB).
 *   2. `verifyAssertionConstraints` — Recipient must match our ACS,
 *      AudienceRestriction must include our entityID, and the
 *      NotBefore / NotOnOrAfter window must respect a 30 s skew.
 *
 * Both helpers are private to the module but re-exported as
 * `__test__.{verifyAssertionConstraints, registerValidator}` so we can
 * exercise them without going through the full samlify parse path.
 */

import type { SsoConfig } from '@tasknebula/db';

// Capture the validator that registerValidator() installs into samlify so
// we can call it directly. The mock records the validate function the
// production code hands to setSchemaValidator.
const samlifyCapture: { validate?: (xml: string) => Promise<string> } = {};

jest.mock('samlify', () => ({
  __esModule: true,
  setSchemaValidator: jest.fn((v: { validate: (xml: string) => Promise<string> }) => {
    samlifyCapture.validate = v.validate;
  }),
  Constants: {
    namespace: {
      binding: {
        redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      },
    },
  },
  ServiceProvider: jest.fn(() => ({})),
  IdentityProvider: jest.fn(() => ({})),
}));

import { __test__, acsUrl, spEntityId } from '../saml';

const { verifyAssertionConstraints, registerValidator } = __test__;

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

const ACS = acsUrl('https://app.example.com', 'acme'); // …/api/auth/saml/acme/callback
const ENTITY_ID = spEntityId('https://app.example.com', 'acme'); // …/metadata.xml

// ---------------------------------------------------------------------------
// Validator (XML wrapping / XXE / oversize guard)
// ---------------------------------------------------------------------------

describe('SAML schema validator', () => {
  let validate: (xml: string) => Promise<string>;

  beforeAll(() => {
    registerValidator();
    // registerValidator is idempotent; on a fresh module load the mock will
    // have captured the validate fn the first time it ran.
    expect(samlifyCapture.validate).toBeDefined();
    validate = samlifyCapture.validate!;
  });

  it('rejects empty / too-short payloads', async () => {
    await expect(validate('')).rejects.toThrow(/empty/i);
    await expect(validate('<x>')).rejects.toThrow(/empty/i);
  });

  it('rejects payloads larger than 3 MB', async () => {
    const big = '<Response>' + 'a'.repeat(3 * 1024 * 1024 + 1) + '</Response>';
    await expect(validate(big)).rejects.toThrow(/too large/i);
  });

  it('rejects <!DOCTYPE declarations (XXE guard)', async () => {
    const xml = '<!DOCTYPE foo><Response></Response>';
    await expect(validate(xml)).rejects.toThrow(/XXE guard/);
  });

  it('rejects <!ENTITY declarations', async () => {
    const xml = '<!ENTITY foo "bar"><Response></Response>';
    await expect(validate(xml)).rejects.toThrow(/Entity declarations|XXE guard/i);
  });

  it('rejects two top-level <Response> tags (wrapping attack)', async () => {
    const xml = '<Response></Response><Response></Response>';
    await expect(validate(xml)).rejects.toThrow(/wrapping attack/i);
  });

  it('rejects two top-level <saml2:Assertion> tags (wrapping attack)', async () => {
    const xml =
      '<Response>' +
      '<saml2:Assertion></saml2:Assertion>' +
      '<saml2:Assertion></saml2:Assertion>' +
      '</Response>';
    await expect(validate(xml)).rejects.toThrow(/wrapping attack/i);
  });

  it("returns 'skipped' for well-formed XML", async () => {
    const xml =
      '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">' +
      '<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" />' +
      '</samlp:Response>';
    await expect(validate(xml)).resolves.toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// verifyAssertionConstraints
// ---------------------------------------------------------------------------

describe('verifyAssertionConstraints', () => {
  const now = Date.now();
  const isoFuture = (ms: number) => new Date(now + ms).toISOString();
  const isoPast = (ms: number) => new Date(now - ms).toISOString();

  const validExtract = () => ({
    subjectConfirmation: {
      recipient: ACS,
    },
    conditions: {
      audience: ENTITY_ID,
      notBefore: isoPast(5_000), // 5 s ago, well inside window
      notOnOrAfter: isoFuture(60_000), // 1 min from now
    },
  });

  it('throws when Recipient is missing', () => {
    const extract = validExtract();
    delete (extract.subjectConfirmation as { recipient?: string }).recipient;
    expect(() => verifyAssertionConstraints(makeCtx(), extract)).toThrow(
      /missing SubjectConfirmation Recipient/i
    );
  });

  it('throws on Recipient mismatch', () => {
    const extract = validExtract();
    extract.subjectConfirmation.recipient = 'https://evil.example.com/acs';
    expect(() => verifyAssertionConstraints(makeCtx(), extract)).toThrow(/mismatch/i);
  });

  it('accepts a matching Recipient + audience string + valid window', () => {
    expect(() => verifyAssertionConstraints(makeCtx(), validExtract())).not.toThrow();
  });

  it('also accepts Recipient under subjectConfirmationData', () => {
    const extract = {
      subjectConfirmation: {
        subjectConfirmationData: { recipient: ACS },
      },
      conditions: {
        audience: ENTITY_ID,
        notBefore: isoPast(5_000),
        notOnOrAfter: isoFuture(60_000),
      },
    };
    expect(() => verifyAssertionConstraints(makeCtx(), extract)).not.toThrow();
  });

  it('throws when AudienceRestriction is missing', () => {
    const extract = validExtract() as { conditions: { audience?: string } };
    delete extract.conditions.audience;
    expect(() =>
      verifyAssertionConstraints(makeCtx(), extract as unknown as Record<string, unknown>)
    ).toThrow(/AudienceRestriction/i);
  });

  it('accepts an audience array that includes our entityID', () => {
    const extract = {
      subjectConfirmation: { recipient: ACS },
      conditions: {
        audience: ['https://other.example.com', ENTITY_ID],
        notBefore: isoPast(5_000),
        notOnOrAfter: isoFuture(60_000),
      },
    };
    expect(() => verifyAssertionConstraints(makeCtx(), extract)).not.toThrow();
  });

  it('throws when NotBefore is more than 30 s in the future', () => {
    const extract = validExtract();
    extract.conditions.notBefore = isoFuture(60_000); // 60 s ahead
    expect(() => verifyAssertionConstraints(makeCtx(), extract)).toThrow(/in the future/i);
  });

  it('throws when NotOnOrAfter is more than 30 s in the past (expired)', () => {
    const extract = validExtract();
    extract.conditions.notOnOrAfter = isoPast(60_000); // expired by 60 s
    expect(() => verifyAssertionConstraints(makeCtx(), extract)).toThrow(/expired/i);
  });
});
