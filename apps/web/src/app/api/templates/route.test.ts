/**
 * @jest-environment node
 */

type Row = Record<string, unknown>;
type Condition =
  | { op: 'eq'; left: unknown; right: unknown }
  | { op: 'inArray'; left: unknown; values: unknown[] }
  | { op: 'and' | 'or'; args: Condition[] }
  | undefined;

const authMock = jest.fn();

const fake = {
  rows: {
    users: [] as Row[],
    organization_members: [] as Row[],
    project_templates: [] as Row[],
  },
};

function table(name: string, columns: string[]) {
  return {
    __name: name,
    ...Object.fromEntries(columns.map((column) => [column, `${name}.${column}`])),
  };
}

function columnKey(column: unknown) {
  if (typeof column !== 'string') return null;
  const parts = column.split('.');
  return parts[parts.length - 1] ?? null;
}

function matches(row: Row, condition: Condition): boolean {
  if (!condition) return true;

  if (condition.op === 'eq') {
    const key = columnKey(condition.left);
    return key ? row[key] === condition.right : false;
  }

  if (condition.op === 'inArray') {
    const key = columnKey(condition.left);
    return key ? condition.values.includes(row[key]) : false;
  }

  if (condition.op === 'and') {
    return condition.args.every((arg) => matches(row, arg));
  }

  if (condition.op === 'or') {
    return condition.args.some((arg) => matches(row, arg));
  }

  return true;
}

function projectRows(rows: Row[], selection?: Record<string, unknown>) {
  if (!selection) return rows;

  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(selection).map(([key, column]) => [key, row[columnKey(column) ?? key]])
    )
  );
}

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@tasknebula/db', () => {
  const users = table('users', ['id', 'isSuperAdmin']);
  const organizationMembers = table('organization_members', [
    'userId',
    'organizationId',
    'role',
    'status',
  ]);
  const projectTemplates = table('project_templates', [
    'id',
    'organizationId',
    'name',
    'description',
    'category',
    'icon',
    'color',
    'kind',
    'payload',
    'usageCount',
    'isPublic',
    'isVerified',
    'createdBy',
    'createdAt',
    'updatedAt',
  ]);

  function select(selection?: Record<string, unknown>) {
    return {
      from(source: { __name: keyof typeof fake.rows }) {
        const builder = {
          condition: undefined as Condition,
          where(condition: Condition) {
            builder.condition = condition;
            return builder;
          },
          orderBy() {
            const rows = fake.rows[source.__name].filter((row) => matches(row, builder.condition));
            return Promise.resolve(projectRows(rows, selection));
          },
          limit(n: number) {
            const rows = fake.rows[source.__name].filter((row) => matches(row, builder.condition));
            return Promise.resolve(projectRows(rows, selection).slice(0, n));
          },
          then(resolve: (rows: Row[]) => unknown) {
            const rows = fake.rows[source.__name].filter((row) => matches(row, builder.condition));
            return Promise.resolve(projectRows(rows, selection)).then(resolve);
          },
        };
        return builder;
      },
    };
  }

  return {
    db: { select },
    and: (...args: Condition[]) => ({ op: 'and', args }),
    or: (...args: Condition[]) => ({ op: 'or', args }),
    eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
    inArray: (left: unknown, values: unknown[]) => ({ op: 'inArray', left, values }),
    desc: (column: unknown) => ({ op: 'desc', column }),
    hasPermission: (role: string, permission: string, isSuperAdmin?: boolean) =>
      Boolean(isSuperAdmin) ||
      (permission === 'org:settings' && (role === 'owner' || role === 'admin')),
    organizationMembers,
    projectTemplates,
    users,
  };
});

import { GET as getTemplate } from './[id]/route';
import { GET as listTemplates } from './route';

function request(url = 'http://localhost/api/templates') {
  return { url } as never;
}

function template(overrides: Partial<Row>): Row {
  return {
    id: 'tpl-default',
    organizationId: 'org-1',
    name: 'Template',
    description: null,
    category: 'general',
    icon: null,
    color: null,
    kind: 'project',
    payload: {},
    usageCount: 0,
    isPublic: false,
    isVerified: false,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    fake.rows.users = [{ id: 'user-1', isSuperAdmin: false }];
    fake.rows.organization_members = [
      { userId: 'user-1', organizationId: 'org-1', role: 'admin', status: 'active' },
    ];
    fake.rows.project_templates = [];
  });

  it('lists member organization templates plus public verified templates', async () => {
    fake.rows.project_templates = [
      template({ id: 'own-private', organizationId: 'org-1', name: 'Own private' }),
      template({
        id: 'marketplace-ok',
        organizationId: 'org-2',
        name: 'Marketplace verified',
        isPublic: true,
        isVerified: true,
      }),
      template({
        id: 'marketplace-unverified',
        organizationId: 'org-3',
        name: 'Marketplace draft',
        isPublic: true,
        isVerified: false,
      }),
      template({ id: 'outside-private', organizationId: 'org-4', name: 'Outside private' }),
    ];

    const response = await listTemplates(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.templates.map((row: Row) => row.id)).toEqual(['own-private', 'marketplace-ok']);
  });

  it('reports every returned organization as administrable for super admins', async () => {
    fake.rows.users = [{ id: 'user-1', isSuperAdmin: true }];
    fake.rows.organization_members = [];
    fake.rows.project_templates = [
      template({ id: 'org-a-template', organizationId: 'org-a' }),
      template({ id: 'org-b-template', organizationId: 'org-b' }),
    ];

    const response = await listTemplates(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canAdminister).toBe(true);
    expect(payload.adminOrganizationIds).toEqual(expect.arrayContaining(['org-a', 'org-b']));
  });
});

describe('GET /api/templates/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    fake.rows.users = [{ id: 'user-1', isSuperAdmin: false }];
    fake.rows.organization_members = [];
    fake.rows.project_templates = [];
  });

  it('allows non-members to read public verified templates', async () => {
    fake.rows.project_templates = [
      template({
        id: 'marketplace-ok',
        organizationId: 'org-2',
        name: 'Marketplace verified',
        isPublic: true,
        isVerified: true,
      }),
    ];

    const response = await getTemplate(request(), {
      params: Promise.resolve({ id: 'marketplace-ok' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: 'marketplace-ok' });
  });

  it('rejects public templates that have not been verified for non-members', async () => {
    fake.rows.project_templates = [
      template({
        id: 'marketplace-draft',
        organizationId: 'org-2',
        name: 'Marketplace draft',
        isPublic: true,
        isVerified: false,
      }),
    ];

    const response = await getTemplate(request(), {
      params: Promise.resolve({ id: 'marketplace-draft' }),
    });

    expect(response.status).toBe(403);
  });
});
