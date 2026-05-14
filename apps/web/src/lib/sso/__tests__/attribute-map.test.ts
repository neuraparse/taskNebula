/**
 * @jest-environment node
 *
 * Attribute-map resolution across common IdP attribute shapes.
 */

import { resolveUserAttributes } from '../attribute-map';

describe('resolveUserAttributes', () => {
  it('reads from URI-style claims (Okta / ADFS)', () => {
    const out = resolveUserAttributes(
      {
        nameId: 'alice@example.com',
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress':
            'alice@example.com',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname':
            'Alice',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname':
            'Liddell',
          'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': [
            'engineering',
            'admins',
          ],
        },
      },
      null
    );
    expect(out.email).toBe('alice@example.com');
    expect(out.firstName).toBe('Alice');
    expect(out.lastName).toBe('Liddell');
    expect(out.groups).toEqual(['engineering', 'admins']);
  });

  it('reads from short keys (Auth0 / generic)', () => {
    const out = resolveUserAttributes(
      {
        nameId: 'bob@example.com',
        attributes: {
          email: 'bob@example.com',
          firstName: 'Bob',
          lastName: 'Ross',
          groups: 'painters',
        },
      },
      null
    );
    expect(out.email).toBe('bob@example.com');
    expect(out.firstName).toBe('Bob');
    expect(out.groups).toEqual(['painters']);
  });

  it('respects an explicit workspace attribute_map override', () => {
    const out = resolveUserAttributes(
      {
        nameId: 'carol@example.com',
        attributes: {
          'custom:email': 'CAROL@example.com',
          'custom:first': 'Carol',
        },
      },
      {
        email: 'custom:email',
        first_name: 'custom:first',
      }
    );
    expect(out.email).toBe('carol@example.com'); // lowercased
    expect(out.firstName).toBe('Carol');
  });

  it('falls back to NameID when no email claim is present', () => {
    const out = resolveUserAttributes(
      {
        nameId: 'dan@example.com',
        attributes: {},
      },
      null
    );
    expect(out.email).toBe('dan@example.com');
  });

  it('throws when no email can be resolved', () => {
    expect(() =>
      resolveUserAttributes(
        { nameId: 'no-email-here', attributes: {} },
        null
      )
    ).toThrow(/email/i);
  });
});
