/**
 * Attribute-map resolution.
 *
 * SAML assertions carry attributes under arbitrary URIs that differ per IdP
 * vendor. The workspace `sso_configs.attribute_map` JSONB maps our internal
 * field names to URIs. This helper walks both maps and pulls the value out
 * of a parsed assertion.
 */

import type { ParsedAssertion } from './saml';

export type InternalUserFields = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
};

const DEFAULT_KEYS: Record<keyof InternalUserFields, string[]> = {
  // Order matters — first hit wins.
  email: [
    'email',
    'mail',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    'urn:oid:0.9.2342.19200300.100.1.3',
  ],
  firstName: [
    'first_name',
    'firstName',
    'givenName',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    'urn:oid:2.5.4.42',
  ],
  lastName: [
    'last_name',
    'lastName',
    'surname',
    'sn',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    'urn:oid:2.5.4.4',
  ],
  groups: [
    'groups',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    'http://schemas.xmlsoap.org/claims/Group',
  ],
};

function readOne(
  attrs: Record<string, string | string[]>,
  candidates: string[]
): string | string[] | undefined {
  for (const key of candidates) {
    if (attrs[key] !== undefined) return attrs[key];
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(attrs)) {
      if (k.toLowerCase() === lowerKey) return attrs[k];
    }
  }
  return undefined;
}

function toScalar(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function toArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.length > 0) return [v];
  return [];
}

/**
 * Resolve a parsed assertion into our internal user shape using the
 * workspace's attribute_map (with sensible per-IdP defaults).
 */
export function resolveUserAttributes(
  assertion: ParsedAssertion,
  attributeMap: Record<string, unknown> | null | undefined
): InternalUserFields {
  const attrs = assertion.attributes || {};
  const map: Record<string, string> = {};
  if (attributeMap && typeof attributeMap === 'object') {
    for (const [k, v] of Object.entries(attributeMap)) {
      if (typeof v === 'string' && v.length > 0) map[k] = v;
    }
  }

  const emailCandidates = [map.email, ...DEFAULT_KEYS.email].filter(
    Boolean
  ) as string[];
  const firstNameCandidates = [
    map.first_name,
    map.firstName,
    ...DEFAULT_KEYS.firstName,
  ].filter(Boolean) as string[];
  const lastNameCandidates = [
    map.last_name,
    map.lastName,
    ...DEFAULT_KEYS.lastName,
  ].filter(Boolean) as string[];
  const groupCandidates = [map.groups, ...DEFAULT_KEYS.groups].filter(
    Boolean
  ) as string[];

  const email =
    toScalar(readOne(attrs, emailCandidates)) ??
    // Fall back to NameID — most IdPs put email there for emailAddress format.
    assertion.nameId;
  if (!email || !email.includes('@')) {
    throw new Error('Unable to resolve email attribute from SAML assertion');
  }

  return {
    email: email.trim().toLowerCase(),
    firstName: toScalar(readOne(attrs, firstNameCandidates)),
    lastName: toScalar(readOne(attrs, lastNameCandidates)),
    groups: toArray(readOne(attrs, groupCandidates)),
  };
}
