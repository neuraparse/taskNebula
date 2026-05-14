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

/** Minimal schema validator. samlify only calls `validate(xml)` so a
 * permissive parser is fine for scaffolding. Replace with `@authenio/samlify-node-xmllint`
 * (or an XSD validator) in production. */
function registerValidator() {
  if (validatorRegistered) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (samlify as any).setSchemaValidator({
    validate: async (response: string) => {
      if (!response || typeof response !== 'string' || response.length < 4) {
        throw new Error('Empty SAML response');
      }
      if (!response.includes('<')) throw new Error('Not XML');
      return 'skipped';
    },
  });
  validatorRegistered = true;
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
  const attributes = (extract.attributes ?? {}) as Record<
    string,
    string | string[]
  >;
  const sessionIndex =
    (extract.sessionIndex as string | undefined) ??
    ((extract as { conditions?: { sessionIndex?: string } }).conditions
      ?.sessionIndex as string | undefined);
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
