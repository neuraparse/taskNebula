/**
 * @jest-environment node
 *
 * SCIM PATCH op handling — both Okta and Microsoft Entra ID semantics must
 * produce the same flat patch shape.
 */

import { applyUserPatch, applyGroupPatch } from '../patch';

const baseUser = {
  userName: 'alice@example.com',
  name: { givenName: 'Alice', familyName: 'Liddell' },
  displayName: 'Alice Liddell',
  active: true,
  emails: [{ value: 'alice@example.com', type: 'work', primary: true }],
};

describe('applyUserPatch — Okta semantics (explicit path, PascalCase ops)', () => {
  it('handles `Replace` displayName', () => {
    const out = applyUserPatch(
      [{ op: 'Replace', path: 'displayName', value: 'A. Liddell' }],
      baseUser
    );
    expect(out.displayName).toBe('A. Liddell');
  });

  it('handles `Replace` active=false (deactivate)', () => {
    const out = applyUserPatch(
      [{ op: 'Replace', path: 'active', value: false }],
      baseUser
    );
    expect(out.active).toBe(false);
  });

  it('handles dotted name path', () => {
    const out = applyUserPatch(
      [{ op: 'Replace', path: 'name.familyName', value: 'Heart' }],
      baseUser
    );
    expect(out.familyName).toBe('Heart');
  });
});

describe('applyUserPatch — Microsoft Entra semantics (implicit path, mixed-case ops)', () => {
  it('handles a `Replace` op with no path and an object value', () => {
    const out = applyUserPatch(
      [
        {
          op: 'Replace',
          value: {
            userName: 'alice2@example.com',
            displayName: 'Alice II',
            active: false,
            name: { givenName: 'AliceTwo' },
          },
        },
      ],
      baseUser
    );
    expect(out.userName).toBe('alice2@example.com');
    expect(out.displayName).toBe('Alice II');
    expect(out.active).toBe(false);
    expect(out.givenName).toBe('AliceTwo');
  });

  it('handles the filtered `emails[type eq "work"].value` path', () => {
    const out = applyUserPatch(
      [
        {
          op: 'replace',
          path: 'emails[type eq "work"].value',
          value: 'alice@work.example.com',
        },
      ],
      baseUser
    );
    expect(out.primaryEmail).toBe('alice@work.example.com');
  });

  it('Entra "add active=true" upserts membership status', () => {
    const out = applyUserPatch(
      [{ op: 'add', path: 'active', value: true }],
      { ...baseUser, active: false }
    );
    expect(out.active).toBe(true);
  });

  it('rejects a remove without a path', () => {
    expect(() =>
      applyUserPatch([{ op: 'remove' }], baseUser)
    ).toThrow(/path/);
  });
});

describe('applyGroupPatch — Okta + Entra membership semantics', () => {
  it('Okta: Replace displayName via path', () => {
    const out = applyGroupPatch([
      { op: 'Replace', path: 'displayName', value: 'New Team' },
    ]);
    expect(out.displayName).toBe('New Team');
  });

  it('Okta: Add members via array value', () => {
    const out = applyGroupPatch([
      {
        op: 'Add',
        path: 'members',
        value: [{ value: 'user_1' }, { value: 'user_2' }],
      },
    ]);
    expect(out.addMembers).toEqual(['user_1', 'user_2']);
  });

  it('Entra: Remove member via filtered path', () => {
    const out = applyGroupPatch([
      { op: 'Remove', path: 'members[value eq "user_3"]' },
    ]);
    expect(out.removeMembers).toEqual(['user_3']);
  });

  it('Entra: Replace whole group with value object (no path)', () => {
    const out = applyGroupPatch([
      {
        op: 'Replace',
        value: {
          displayName: 'Engineering',
          members: [{ value: 'user_1' }, { value: 'user_4' }],
        },
      },
    ]);
    expect(out.displayName).toBe('Engineering');
    expect(out.replaceMembers).toEqual(['user_1', 'user_4']);
  });
});
