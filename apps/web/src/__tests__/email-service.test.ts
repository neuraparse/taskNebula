/**
 * @jest-environment node
 */

/**
 * Email service tests.
 *
 * We test shouldSendEmail indirectly through sendEmail by observing whether
 * nodemailer.createTransport().sendMail was called and whether the returned
 * messageId equals 'skipped-by-preferences'.
 *
 * Time assumption: the production code uses `now.getHours()` (local time),
 * so we mock the system clock with a Date whose local-time hour we control.
 * `new Date('2026-04-21T12:00:00')` (no `Z`) is parsed as local time and
 * therefore yields `getHours() === 12` regardless of the host timezone.
 */

// Path resolved through the apps/web symlink at node_modules/@tasknebula/db
// → packages/db. We mock the db index (relative path used by email-service)
// and nodemailer before importing the email-service module.
const sendMailMock = jest.fn();
const createTransportMock = jest.fn(() => ({
  sendMail: sendMailMock,
}));
const dbSelectMock = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: (...args: unknown[]) => createTransportMock(...args),
  },
  createTransport: (...args: unknown[]) => createTransportMock(...args),
}));

jest.mock('@tasknebula/db/src/index', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
}));

jest.mock('@tasknebula/db/src/schema', () => ({
  emailTemplates: {
    organizationId: 'et.organizationId',
    type: 'et.type',
    isActive: 'et.isActive',
    isDefault: 'et.isDefault',
  },
  notificationPreferences: {
    userId: 'np.userId',
    organizationId: 'np.organizationId',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

type SendEmail = typeof import('@tasknebula/db/src/utils/email-service').sendEmail;

/**
 * Sets up db.select() to return pref rows for the first call (prefs lookup)
 * and empty rows for subsequent template lookups (forces BUILTIN_TEMPLATES).
 */
function mockDbWithPrefs(prefs: Record<string, unknown> | null) {
  dbSelectMock.mockImplementation(() => ({
    from: () => ({
      where: () => Promise.resolve(prefs ? [prefs] : []),
    }),
  }));
}

const ORIGINAL_ENV = { ...process.env };

async function loadService(): Promise<{ sendEmail: SendEmail }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@tasknebula/db/src/utils/email-service') as {
    sendEmail: SendEmail;
  };
}

describe('email-service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Re-register mocks after resetModules so the fresh module picks them up.
    jest.doMock('nodemailer', () => ({
      __esModule: true,
      default: {
        createTransport: (...args: unknown[]) => createTransportMock(...args),
      },
      createTransport: (...args: unknown[]) => createTransportMock(...args),
    }));
    jest.doMock('@tasknebula/db/src/index', () => ({
      db: {
        select: (...args: unknown[]) => dbSelectMock(...args),
      },
    }));
    jest.doMock('@tasknebula/db/src/schema', () => ({
      emailTemplates: {
        organizationId: 'et.organizationId',
        type: 'et.type',
        isActive: 'et.isActive',
        isDefault: 'et.isDefault',
      },
      notificationPreferences: {
        userId: 'np.userId',
        organizationId: 'np.organizationId',
      },
    }));
    jest.doMock('drizzle-orm', () => ({
      and: (...args: unknown[]) => ({ type: 'and', args }),
      eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
    }));

    sendMailMock.mockResolvedValue({ messageId: 'sent-id' });
    // Default: no prefs row, no template row.
    dbSelectMock.mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }));
    process.env = { ...ORIGINAL_ENV, SMTP_HOST: 'smtp.test' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    jest.useRealTimers();
  });

  describe('SMTP configuration', () => {
    it('returns email-disabled when SMTP_HOST is unset', async () => {
      delete process.env.SMTP_HOST;
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('email-disabled');
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('sends when no userId is passed (skips pref check)', async () => {
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {
          issueKey: 'T-1',
          issueTitle: 'Title',
          actorName: 'Alice',
          projectName: 'Proj',
        },
        organizationId: 'org-1',
      });
      expect(result.messageId).toBe('sent-id');
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldSendEmail policy (no prefs row)', () => {
    it('sends issue_assigned (quiet default: true)', async () => {
      mockDbWithPrefs(null);
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: { issueKey: 'T-1', issueTitle: 'Hi' },
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).not.toBe('skipped-by-preferences');
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    });

    it('skips issue_commented (quiet default: false — regression)', async () => {
      mockDbWithPrefs(null);
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_commented',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('sends issue_mentioned (quiet default: true)', async () => {
      mockDbWithPrefs(null);
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_mentioned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(result.messageId).not.toBe('skipped-by-preferences');
    });

    it('skips sprint_started (quiet default: false)', async () => {
      mockDbWithPrefs(null);
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'sprint_started',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('falls back to quiet policy for unmapped events like daily_digest', async () => {
      mockDbWithPrefs(null);
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'daily_digest',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe('shouldSendEmail policy (with prefs row)', () => {
    const basePrefs = {
      enableEmail: true,
      emailOnAssigned: true,
      emailOnMentioned: true,
      emailOnCommented: true,
      emailOnStatusChanged: true,
      emailOnIssueCreated: true,
      emailOnSprintStarted: true,
      emailOnSprintCompleted: true,
      doNotDisturb: false,
      doNotDisturbStart: null,
      doNotDisturbEnd: null,
    };

    it('enableEmail:false kills everything', async () => {
      mockDbWithPrefs({ ...basePrefs, enableEmail: false });
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('respects per-event opt-out', async () => {
      mockDbWithPrefs({ ...basePrefs, emailOnAssigned: false });
      const { sendEmail: sendAssigned } = await loadService();
      const assigned = await sendAssigned({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(assigned.messageId).toBe('skipped-by-preferences');

      // Same prefs row, different event → sends.
      const mentioned = await sendAssigned({
        to: 'a@b.com',
        templateType: 'issue_mentioned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(mentioned.messageId).not.toBe('skipped-by-preferences');
    });

    it('unmapped event name with a prefs row also falls back to quiet policy', async () => {
      mockDbWithPrefs({ ...basePrefs });
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'daily_digest',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
    });
  });

  describe('DND windows', () => {
    const dndPrefs = (start: string | null, end: string | null) => ({
      enableEmail: true,
      emailOnAssigned: true,
      emailOnMentioned: true,
      emailOnCommented: true,
      emailOnStatusChanged: true,
      emailOnIssueCreated: true,
      emailOnSprintStarted: true,
      emailOnSprintCompleted: true,
      doNotDisturb: true,
      doNotDisturbStart: start,
      doNotDisturbEnd: end,
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('same-day window 09:00–17:00 skips at 12:00', async () => {
      jest.useFakeTimers();
      // Local-time 12:00 (no 'Z' — parsed as local).
      jest.setSystemTime(new Date('2026-04-21T12:00:00'));
      mockDbWithPrefs(dndPrefs('09:00', '17:00'));
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
    });

    it('same-day window 09:00–17:00 sends at 20:00', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-21T20:00:00'));
      mockDbWithPrefs(dndPrefs('09:00', '17:00'));
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).not.toBe('skipped-by-preferences');
    });

    it('overnight 22:00–08:00 skips at 23:00', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-21T23:00:00'));
      mockDbWithPrefs(dndPrefs('22:00', '08:00'));
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
    });

    it('overnight 22:00–08:00 skips at 03:00', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-21T03:00:00'));
      mockDbWithPrefs(dndPrefs('22:00', '08:00'));
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).toBe('skipped-by-preferences');
    });

    it('overnight 22:00–08:00 sends at 09:00', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-21T09:00:00'));
      mockDbWithPrefs(dndPrefs('22:00', '08:00'));
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).not.toBe('skipped-by-preferences');
    });

    it('overnight 22:00–08:00 sends at 21:00', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-21T21:00:00'));
      mockDbWithPrefs(dndPrefs('22:00', '08:00'));
      const { sendEmail } = await loadService();
      const result = await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {},
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.messageId).not.toBe('skipped-by-preferences');
    });
  });

  describe('templates', () => {
    it('substitutes variables in the sendMail html', async () => {
      // no prefs row → policy decides (assigned = true), no userId to skip
      const { sendEmail } = await loadService();
      await sendEmail({
        to: 'a@b.com',
        templateType: 'issue_assigned',
        variables: {
          issueTitle: 'Regression found',
          issueKey: 'T-99',
          actorName: 'Alice',
          projectName: 'Alpha',
        },
        organizationId: 'org-1',
      });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0]?.[0] as {
        html: string;
        subject: string;
        text: string;
      };
      expect(call.html).toContain('Regression found');
      expect(call.subject).toContain('T-99');
      expect(call.text).toContain('Alice');
    });
  });
});
