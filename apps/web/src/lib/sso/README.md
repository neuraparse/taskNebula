# SAML 2.0 SSO + SCIM 2.0 — TaskNebula

This directory is the server-side core of TaskNebula's enterprise SSO stack
(Roadmap task #17). It exposes:

- `saml.ts` — SP metadata, AuthnRequest builder, response verifier. Wraps
  `samlify` so the rest of the app never imports it directly.
- `jit.ts` — Just-in-time user / membership provisioning from a verified SAML
  assertion.
- `tokens.ts` — SCIM bearer-token hashing & verification (bcrypt-based, with
  an Argon2 hook for future migration).
- `entities.ts` — In-process cache of `samlify` IdentityProvider / ServiceProvider
  objects keyed by workspace slug.
- `attribute-map.ts` — Default attribute URIs per IdP vendor and a resolver
  that pulls values out of a SAML assertion using the workspace `attribute_map`.

The matching SCIM logic lives next door in `apps/web/src/lib/scim/`.

## Endpoints

| Method  | Path                                                  | Purpose                                |
| ------- | ----------------------------------------------------- | -------------------------------------- |
| GET     | `/api/auth/saml/[workspace_slug]/metadata.xml`        | SP metadata for IdP setup              |
| GET/POST| `/api/auth/saml/[workspace_slug]/init`                | Generate SAMLRequest, redirect to IdP  |
| POST    | `/api/auth/saml/[workspace_slug]/callback`            | ACS endpoint — verify & JIT-provision  |
| GET     | `/api/scim/v2/Users` (+ `[id]`)                       | SCIM 2.0 Users (RFC 7644)              |
| GET     | `/api/scim/v2/Groups` (+ `[id]`)                      | SCIM 2.0 Groups                        |

SCIM auth is `Authorization: Bearer <token>`, where `<token>` is verified by
bcrypt-compare against `scim_tokens.token_hash` for an enabled workspace.
The token is shown **once** at creation time; the DB stores only the hash.

## IdP-specific quirks

The SCIM 2.0 RFC is a polite suggestion. In practice every major IdP
diverges. Notable behaviours we cope with:

### Okta

- **PUT** is preferred for replace operations — Okta uses `PUT /Users/{id}`
  with a full resource representation when an attribute changes.
- Group membership uses `PATCH /Groups/{id}` with `Operations: [{op:'add', path:'members', value:[{value:userId}]}]`.
- Sends `active: false` (lowercase) on de-provision.
- Filter syntax in `GET /Users?filter=...` is conservative: only `userName eq "x"` is reliably exercised.

### Microsoft Entra ID (formerly Azure AD)

- **PATCH-only.** Entra never issues PUT. Every attribute change arrives as a
  PATCH with an `Operations` array (`Replace` / `Add` / `Remove`).
- Uses a non-standard `path` syntax for complex attributes, e.g.
  `emails[type eq "work"].value`. Our PATCH handler walks the operations
  array and resolves these paths to flat user columns.
- `enterprise:User:2.0` extension is sent on every payload — we accept and
  ignore unknown attributes silently per RFC 7644 §3.3.
- Always sends `Content-Type: application/scim+json`.

### Google Workspace

- **POST-only on initial provisioning** — Google creates users with `POST
  /Users` and uses `PATCH` for subsequent updates, but **never sends PUT**.
- Drops users via `DELETE /Users/{id}` (most IdPs prefer soft de-provision via
  `active=false` PATCH, which we also accept).
- Group attribute names use `members[].value`.
- Filter syntax: only `userName eq` and `externalId eq`.

### General

- All endpoints return `application/scim+json` with the SCIM `schemas`
  envelope. Errors follow RFC 7644 §3.12 (`urn:ietf:params:scim:api:messages:2.0:Error`).
- `meta.location` is included on every resource — Okta and Entra both rely on
  it to build subsequent PUT/PATCH URLs.
- Pagination: `startIndex` is **1-based** per RFC 7644 §3.4.2.4.

## Testing notes

Real IdP testing is out of scope for the scaffolding milestone. The Jest
suites under `apps/web/src/lib/sso/__tests__/` cover:

- SAML response signature verification (with a fixture cert + signed XML)
- SCIM PATCH op handling for both Microsoft and Okta semantics
- Bearer-token hashing (constant-time compare)
- Attribute-map resolution

For end-to-end IdP smoke tests, see `docs/sso-test-plan.md` (TODO).
