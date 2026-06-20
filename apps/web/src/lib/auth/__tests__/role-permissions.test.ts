/**
 * @jest-environment node
 */

import {
  getRolePermissions,
  hasPermission,
} from '../../../../../../packages/db/src/utils/permissions';

describe('organization role permissions', () => {
  it('does not let a regular organization member create projects', () => {
    expect(hasPermission('member', 'project:create')).toBe(false);
    expect(getRolePermissions('member')).not.toContain('project:create');
  });

  it('keeps project creation reserved for organization admins and owners', () => {
    expect(hasPermission('admin', 'project:create')).toBe(true);
    expect(hasPermission('owner', 'project:create')).toBe(true);
  });
});
