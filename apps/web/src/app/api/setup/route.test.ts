/**
 * @jest-environment node
 */

const dbSelectMock = jest.fn();

class MockNextResponse {
  constructor(
    private readonly payload: unknown,
    init?: { status?: number }
  ) {
    this.status = init?.status || 200;
  }

  status: number;

  async json() {
    return this.payload;
  }

  static json(payload: unknown, init?: { status?: number }) {
    return new MockNextResponse(payload, init);
  }
}

jest.mock('next/server', () => ({
  NextResponse: MockNextResponse,
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
  },
  hash: jest.fn(),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-id',
}));

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    transaction: jest.fn(),
  },
  users: {},
  organizations: {},
  organizationMembers: {},
  workflows: {},
  workflowStatuses: {},
  workflowTransitions: {},
}));

jest.mock('drizzle-orm', () => ({
  sql: () => ({}),
}));

function fromBuilder(result: unknown) {
  return {
    from: jest.fn().mockResolvedValue(result),
  };
}

describe('GET /api/setup', () => {
  let GET: typeof import('./route').GET;

  beforeAll(async () => {
    ({ GET } = await import('./route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not expose the exact user count after setup is complete', async () => {
    dbSelectMock.mockReturnValue(fromBuilder([{ count: 42 }]));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ setupRequired: false });
  });
});
