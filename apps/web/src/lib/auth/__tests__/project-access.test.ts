/**
 * @jest-environment node
 */

const mockResolveProjectByIdOrKey = jest.fn();
const mockCanReadProject = jest.fn();
const mockCanManageProject = jest.fn();

jest.mock('@/lib/projects/server', () => ({
  resolveProjectByIdOrKey: (...args: unknown[]) => mockResolveProjectByIdOrKey(...args),
}));

jest.mock('@/lib/auth/access-control', () => ({
  canReadProject: (...args: unknown[]) => mockCanReadProject(...args),
  canManageProject: (...args: unknown[]) => mockCanManageProject(...args),
}));

import { resolveProjectAccess } from '../project-access';

describe('resolveProjectAccess', () => {
  beforeEach(() => {
    mockResolveProjectByIdOrKey.mockReset();
    mockCanReadProject.mockReset();
    mockCanManageProject.mockReset();
  });

  it('scopes project resolution to the requesting user', async () => {
    mockResolveProjectByIdOrKey.mockResolvedValue(null);

    const result = await resolveProjectAccess('user-1', 'PRJ');

    expect(mockResolveProjectByIdOrKey).toHaveBeenCalledWith('PRJ', 'user-1');
    expect(result).toEqual({ project: null, canRead: false, canManage: false });
    expect(mockCanReadProject).not.toHaveBeenCalled();
    expect(mockCanManageProject).not.toHaveBeenCalled();
  });

  it('does not compute manage permissions when the user cannot read the project', async () => {
    const project = { id: 'project-1', organizationId: 'org-1' };
    mockResolveProjectByIdOrKey.mockResolvedValue(project);
    mockCanReadProject.mockResolvedValue(false);

    const result = await resolveProjectAccess('user-1', 'project-1');

    expect(result).toEqual({ project, canRead: false, canManage: false });
    expect(mockCanReadProject).toHaveBeenCalledWith('user-1', project);
    expect(mockCanManageProject).not.toHaveBeenCalled();
  });

  it('returns read and manage decisions for an accessible project', async () => {
    const project = { id: 'project-1', organizationId: 'org-1' };
    mockResolveProjectByIdOrKey.mockResolvedValue(project);
    mockCanReadProject.mockResolvedValue(true);
    mockCanManageProject.mockResolvedValue(true);

    const result = await resolveProjectAccess('user-1', 'project-1');

    expect(result).toEqual({ project, canRead: true, canManage: true });
    expect(mockCanManageProject).toHaveBeenCalledWith('user-1', project);
  });
});
