import { extractAuthTokenInput, parseSignupInviteInput } from './auth-links';

describe('auth link parsing', () => {
  it('extracts reset tokens from full web reset links', () => {
    expect(
      extractAuthTokenInput('https://tasks.example.com/auth/reset-password?token=reset-1', [
        'token',
      ]),
    ).toBe('reset-1');
  });

  it('keeps plain reset tokens unchanged', () => {
    expect(extractAuthTokenInput(' reset-plain ', ['token'])).toBe('reset-plain');
  });

  it('extracts organization invite signup data from web links', () => {
    expect(
      parseSignupInviteInput(
        'https://tasks.example.com/auth/signup?email=User%40Example.com&token=invite-1',
      ),
    ).toEqual({
      email: 'user@example.com',
      inviteToken: 'invite-1',
    });
  });

  it('extracts project invite tokens from signup links and join links', () => {
    expect(
      parseSignupInviteInput('https://tasks.example.com/auth/signup?projectInviteToken=project-1'),
    ).toEqual({ projectInviteToken: 'project-1' });

    expect(parseSignupInviteInput('https://tasks.example.com/join/project/project-2')).toEqual({
      projectInviteToken: 'project-2',
    });
  });
});
