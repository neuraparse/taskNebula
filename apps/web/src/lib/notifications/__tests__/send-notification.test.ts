/**
 * @jest-environment node
 */

const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const insertValuesMock = jest.fn();
const sendEmailMock = jest.fn();

const mockTable = new Proxy(
  {},
  {
    get: (_target, prop) => String(prop),
  }
);

function mockReplaceVariables(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value || ''),
    template
  );
}

jest.mock('@tasknebula/db', () => ({
  BUILTIN_TEMPLATES: {
    issue_assigned: {
      subject: '{{issueKey}} assigned to you',
      html: '<a href="{{issueUrl}}">{{issueTitle}}</a>',
      text: '{{actorName}} assigned {{issueKey}}',
    },
  },
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
  emailTemplateTypeEnum: {
    enumValues: ['issue_assigned', 'project_created', 'project_archived'],
  },
  emailTemplates: mockTable,
  notifications: mockTable,
  notificationPreferences: mockTable,
  organizations: mockTable,
  replaceVariables: mockReplaceVariables,
  users: mockTable,
}));

jest.mock('@/lib/email/sender', () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

function chainable<T>(result: T) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    limit: () => Promise<T>;
    then: (resolve: (value: T) => unknown) => unknown;
  } = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve) => resolve(result),
  };
  return chain;
}

function mockSelectSequence(...results: unknown[][]) {
  const queue = [...results];
  dbSelectMock.mockImplementation(() => chainable(queue.shift() ?? []));
}

const BASE_PARAMS = {
  eventType: 'issue_assigned' as const,
  recipientUserId: 'user-recipient',
  actorUserId: 'user-actor',
  organizationId: 'org-1',
  issueId: 'issue-1',
  projectId: 'project-1',
  issueKey: 'TN-42',
  issueTitle: 'Fix assignment notifications',
  projectName: 'Core Platform',
};

describe('notifyIssueEventNow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.tasknebula.test';
    insertValuesMock.mockResolvedValue([]);
    dbInsertMock.mockReturnValue({ values: (...args: unknown[]) => insertValuesMock(...args) });
    sendEmailMock.mockResolvedValue({ sent: true, messageId: 'mail-1' });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('stores an in-app assignment notification and sends the email through the app sender', async () => {
    const { notifyIssueEventNow } = await import('../send-notification');
    mockSelectSequence(
      [{ email: 'grace@example.com', name: 'Grace Hopper' }],
      [{ email: 'ada@example.com', name: 'Ada Lovelace' }],
      [{ name: 'TaskNebula Demo' }],
      [],
      [],
      [],
      []
    );

    await notifyIssueEventNow(BASE_PARAMS);

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-recipient',
        type: 'assigned',
        issueId: 'issue-1',
        projectId: 'project-1',
        actorId: 'user-actor',
      })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'grace@example.com',
        subject: 'TN-42 assigned to you',
        html: expect.stringContaining('https://app.tasknebula.test/issues/issue-1'),
      })
    );
  });

  it('respects master in-app and email opt-outs', async () => {
    const { notifyIssueEventNow } = await import('../send-notification');
    const prefs = {
      enableInApp: false,
      enableEmail: false,
      inAppOnAssigned: true,
      emailOnAssigned: true,
      doNotDisturb: false,
      doNotDisturbStart: null,
      doNotDisturbEnd: null,
    };
    mockSelectSequence(
      [{ email: 'grace@example.com', name: 'Grace Hopper' }],
      [{ email: 'ada@example.com', name: 'Ada Lovelace' }],
      [{ name: 'TaskNebula Demo' }],
      [prefs],
      [prefs]
    );

    await notifyIssueEventNow(BASE_PARAMS);

    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('keeps the in-app notification during do-not-disturb but suppresses email', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-21T12:00:00'));

    const { notifyIssueEventNow } = await import('../send-notification');
    const emailPrefs = {
      enableEmail: true,
      emailOnAssigned: true,
      doNotDisturb: true,
      doNotDisturbStart: '09:00',
      doNotDisturbEnd: '17:00',
    };
    mockSelectSequence(
      [{ email: 'grace@example.com', name: 'Grace Hopper' }],
      [{ email: 'ada@example.com', name: 'Ada Lovelace' }],
      [{ name: 'TaskNebula Demo' }],
      [],
      [emailPrefs]
    );

    await notifyIssueEventNow(BASE_PARAMS);

    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
