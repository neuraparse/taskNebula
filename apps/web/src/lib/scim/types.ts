/**
 * SCIM 2.0 schema constants & error helpers.
 *
 * RFC 7643 (Core Schema) defines the resource shapes; RFC 7644 (Protocol)
 * defines the wire format. We implement the User & Group resources, the
 * ListResponse envelope, the PATCH op semantics (RFC 7644 §3.5.2), and the
 * Error response.
 */
import { NextResponse } from 'next/server';

export const SCIM_CONTENT_TYPE = 'application/scim+json';

export const SCIM_SCHEMAS = {
  user: 'urn:ietf:params:scim:schemas:core:2.0:User',
  enterpriseUser: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
  group: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  listResponse: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  patchOp: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
  error: 'urn:ietf:params:scim:api:messages:2.0:Error',
};

export type ScimError = {
  schemas: [typeof SCIM_SCHEMAS.error];
  status: string;
  scimType?: string;
  detail?: string;
};

export function scimResponse(body: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': SCIM_CONTENT_TYPE },
  });
}

export function scimError(
  status: number,
  detail: string,
  scimType?: string
): NextResponse {
  const body: ScimError = {
    schemas: [SCIM_SCHEMAS.error],
    status: String(status),
    detail,
  };
  if (scimType) body.scimType = scimType;
  return scimResponse(body, status);
}

export type ScimUserRecord = {
  schemas: string[];
  id: string;
  userName: string;
  name?: { givenName?: string | null; familyName?: string | null; formatted?: string | null };
  displayName?: string | null;
  active: boolean;
  emails?: { value: string; primary?: boolean; type?: string }[];
  meta: { resourceType: 'User'; created?: string; lastModified?: string; location?: string };
};

export type ScimGroupRecord = {
  schemas: string[];
  id: string;
  displayName: string;
  members: { value: string; display?: string; type?: 'User' | 'Group' }[];
  meta: { resourceType: 'Group'; created?: string; lastModified?: string; location?: string };
};

export type PatchOperation = {
  op: 'add' | 'remove' | 'replace' | 'Add' | 'Remove' | 'Replace';
  path?: string;
  value?: unknown;
};

export type PatchRequest = {
  schemas: string[];
  Operations: PatchOperation[];
};
