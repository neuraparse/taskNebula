/**
 * SAML 2.0 helpers — server-only.
 *
 * Thin wrapper around `samlify` that:
 *   - resolves the SP / IdP entities from a workspace `sso_configs` row,
 *   - generates redirect-binding AuthnRequests,
 *   - verifies & parses POST-binding responses (signature + attributes).
 *
 * `samlify` requires a schema validator. We register a permissive validator
 * here that accepts well-formed XML — full XSD validation is left to a
 * dedicated production deployment (see README for hardening notes).
 */
import * as samlify from 'samlify';
import type { SsoConfig } from '@tasknebula/db';

let validatorRegistered = false;

/**
 * Schema validator with defensive sanity checks.
 *
 * samlify expects an async `validate(xml)` callback whose throw aborts
 * the parse. The strict-validator-grade option is
 * `@authenio/samlify-node-xmllint`, but that pulls a node-gyp dep we
 * don't want to ship by default. Until an operator opts into the native
 * validator, we run a series of structural checks here that catch the
 * most common SAML-malformed-payload attacks:
 *
 *   - empty / non-string / non-XML payloads (the original guard),
 *   - DTD declarations (XXE vectors) — Linux libxml2 honours `<!DOCTYPE …`
 *     external entities by default and there is no reason an IdP would
 *     include one in a SAML response,
 *   - external entity references inside the body (`<!ENTITY …`),
 *   - more than one top-level `<Response>` / `<Assertion>` element (a
 *     telltale of XML signature-wrapping attempts),
 *   - oversized payloads (3 MB cap — a real SAML response is < 100 KB).
 *
 * This isn't a substitute for XSD validation, but it closes the obvious
 * holes the previous "accepts anything with a `<`" placeholder left
 * open. Replace with the strict samlify validator in production for
 * defence-in-depth.
 */
function registerValidator() {
  if (validatorRegistered) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (samlify as any).setSchemaValidator({
    validate: async (response: string) => {
      if (!response || typeof response !== 'string' || response.length < 4) {
        throw new Error('Empty SAML response');
      }
      if (response.length > 3 * 1024 * 1024) {
        throw new Error('SAML response too large');
      }
      if (!response.includes('<')) throw new Error('Not XML');
      if (/<!DOCTYPE\b/i.test(response)) {
        throw new Error('DOCTYPE declarations are not allowed (XXE guard)');
      }
      if (/<!ENTITY\b/i.test(response)) {
        throw new Error('Entity declarations are not allowed (XXE guard)');
      }
      // Count top-level Response / Assertion elements via a tolerant regex
      // — full XML parsing happens later inside samlify; we just want to
      // reject the common wrapping shape that embeds a second signed
      // assertion inside the response envelope.
      const responseTags = (response.match(/<(?:[A-Za-z0-9_-]+:)?Response\b/g) || []).length;
      if (responseTags > 1) {
        throw new Error('Multiple <Response> elements detected (wrapping attack)');
      }
      const assertionTags = (response.match(/<(?:[A-Za-z0-9_-]+:)?Assertion\b/g) || []).length;
      if (assertionTags > 1) {
        throw new Error('Multiple <Assertion> elements detected (wrapping attack)');
      }
      return 'skipped';
    },
  });
  validatorRegistered = true;
}

/**
 * Defence-in-depth checks layered on top of samlify's signature parse.
 *
 * samlify enforces signature + audience + timestamp when configured for
 * "want assertions signed", but the response-vs-assertion-only stance
 * leaves three weak spots that we tighten manually:
 *
 *   1. Recipient — must match our exact ACS URL. Without this, an
 *      attacker can submit a SAML response originally minted for an
 *      unrelated SP, and samlify will still accept it because the
 *      signature itself is valid.
 *   2. NotBefore / NotOnOrAfter — samlify checks these but we add a
 *      stricter ±30s clock-skew bound, refusing too-fresh as well as
 *      expired payloads (replay window guard).
 *   3. Audience — must include our SP entityID.
 *
 * Throwing here causes the route to return a generic 401 and the
 * incident is logged.
 */
function verifyAssertionConstraints(ctx: SamlContext, extract: Record<string, unknown>): void {
  const wantAcs = acsUrl(ctx.baseUrl, ctx.workspaceSlug);
  const wantAudience = spEntityId(ctx.baseUrl, ctx.workspaceSlug);

  // Subject confirmation Recipient. samlify exposes it as
  // `subjectConfirmation.subjectConfirmationData.recipient` (lowercase
  // when extracted into JS-friendly keys). Be tolerant of either shape.
  type Conf = { recipient?: string; subjectConfirmationData?: { recipient?: string } };
  const conf = (extract.subjectConfirmation ?? extract.subjectconfirmation) as Conf | undefined;
  const recipient = conf?.recipient ?? conf?.subjectConfirmationData?.recipient;
  if (!recipient) {
    throw new Error('SAML assertion missing SubjectConfirmation Recipient');
  }
  if (recipient !== wantAcs) {
    throw new Error(`SAML Recipient mismatch (got ${recipient}, want ${wantAcs})`);
  }

  // AudienceRestriction. Some IdPs return a string, some an array. Accept
  // either; require our entityID to appear in the list.
  const conditions = extract.conditions as
    | { audience?: string | string[]; audienceRestriction?: string | string[] }
    | undefined;
  const audienceRaw = conditions?.audience ?? conditions?.audienceRestriction;
  const audiences = Array.isArray(audienceRaw)
    ? audienceRaw
    : typeof audienceRaw === 'string'
      ? [audienceRaw]
      : [];
  if (audiences.length === 0) {
    throw new Error('SAML assertion missing AudienceRestriction');
  }
  if (!audiences.includes(wantAudience)) {
    throw new Error(`SAML Audience mismatch (want ${wantAudience}, saw ${audiences.join(', ')})`);
  }

  // Tight clock-skew window. samlify is lenient about future-dated
  // `NotBefore`; we cap at 30 s.
  const SKEW_MS = 30 * 1000;
  const now = Date.now();
  const notBefore = conditions
    ? Date.parse((conditions as { notBefore?: string }).notBefore ?? '')
    : NaN;
  if (Number.isFinite(notBefore) && notBefore - now > SKEW_MS) {
    throw new Error('SAML assertion NotBefore is in the future');
  }
  const notOnOrAfter = conditions
    ? Date.parse((conditions as { notOnOrAfter?: string }).notOnOrAfter ?? '')
    : NaN;
  if (Number.isFinite(notOnOrAfter) && now - notOnOrAfter > SKEW_MS) {
    throw new Error('SAML assertion has expired');
  }
}

export type SamlContext = {
  config: SsoConfig;
  workspaceSlug: string;
  baseUrl: string;
};

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function spEntityId(baseUrl: string, slug: string): string {
  return `${baseUrl}/api/auth/saml/${slug}/metadata.xml`;
}

export function acsUrl(baseUrl: string, slug: string): string {
  return `${baseUrl}/api/auth/saml/${slug}/callback`;
}

function pemNormalize(cert: string): string {
  // samlify accepts either raw base64 or wrapped PEM. Strip BEGIN/END and
  // whitespace so we can hand it back as a clean base64 string.
  return cert
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Build a samlify ServiceProvider instance for a given workspace.
 */
export function buildServiceProvider(ctx: SamlContext) {
  registerValidator();
  const { ServiceProvider } = samlify;
  const { baseUrl, workspaceSlug, config } = ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ServiceProvider as any)({
    entityID: spEntityId(baseUrl, workspaceSlug),
    authnRequestsSigned: !!config.privateKey,
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
    assertionConsumerService: [
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: acsUrl(baseUrl, workspaceSlug),
      },
    ],
    privateKey: config.privateKey ?? undefined,
  });
}

/**
 * Build a samlify IdentityProvider instance for a given workspace's IdP.
 */
export function buildIdentityProvider(ctx: SamlContext) {
  registerValidator();
  const { IdentityProvider } = samlify;
  const { config } = ctx;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (IdentityProvider as any)({
    entityID: config.issuer,
    singleSignOnService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: config.entryPointUrl,
      },
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: config.entryPointUrl,
      },
    ],
    signingCert: pemNormalize(config.cert),
    wantAuthnRequestsSigned: false,
  });
}

/**
 * Generate the redirect URL the browser should be sent to for SP-initiated
 * SSO. Returns a fully-formed `Location:` value.
 */
export function buildAuthnRequestUrl(ctx: SamlContext): string {
  const sp = buildServiceProvider(ctx);
  const idp = buildIdentityProvider(ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { context } = sp.createLoginRequest(idp, 'redirect') as any;
  // samlify returns a fully-built redirect URL in `context` for the redirect
  // binding (query string already encoded).
  return context;
}

export type ParsedAssertion = {
  nameId: string;
  sessionIndex?: string;
  attributes: Record<string, string | string[]>;
};

/**
 * Verify a POST-binding SAML response and return the parsed assertion.
 * Throws on signature mismatch / replay.
 */
export async function parseLoginResponse(
  ctx: SamlContext,
  samlResponse: string
): Promise<ParsedAssertion> {
  const sp = buildServiceProvider(ctx);
  const idp = buildIdentityProvider(ctx);
  // samlify expects an Express-like { body: { SAMLResponse } } shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await sp.parseLoginResponse(idp, 'post', {
    body: { SAMLResponse: samlResponse },
  })) as { extract?: Record<string, unknown> } | undefined;

  const extract = (result?.extract ?? {}) as Record<string, unknown>;
  const nameId = (extract.nameID || extract.nameid || '') as string;
  if (!nameId) {
    throw new Error('SAML response missing NameID');
  }
  // Tight defence-in-depth on top of samlify's signature/audience parse:
  // Recipient, AudienceRestriction membership, and clock-skew bounds.
  // Throwing here aborts the route with the generic 401 it already
  // returns for signature failures.
  verifyAssertionConstraints(ctx, extract);
  const attributes = (extract.attributes ?? {}) as Record<string, string | string[]>;
  const sessionIndex =
    (extract.sessionIndex as string | undefined) ??
    ((extract as { conditions?: { sessionIndex?: string } }).conditions?.sessionIndex as
      | string
      | undefined);
  return { nameId, attributes, sessionIndex };
}

/**
 * Serialize SP metadata XML for the IdP to consume.
 */
export function getSpMetadataXml(ctx: SamlContext): string {
  const sp = buildServiceProvider(ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sp as any).getMetadata();
}

// Test-only export. The two helpers below are intentionally private at the
// module level; exposing them through a `__test__` bag keeps the public
// surface clean while letting the constraint-level unit tests exercise
// them in isolation. Do not import this from production code.
export const __test__ = { verifyAssertionConstraints, registerValidator };
