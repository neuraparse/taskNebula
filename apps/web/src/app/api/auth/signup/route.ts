import { NextRequest, NextResponse } from 'next/server';
import { db, users, organizationMembers } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import { getRegistrationPolicy } from '@/lib/auth/registration-policy';
import {
  createUserWithProjectInviteLink,
  isProjectInviteLinkUsable,
  ProjectInviteLinkError,
} from '@/lib/invitations/project-invite-links';

const GENERIC_SIGNUP_MESSAGE = 'If that email is available, an account will be created';
const REGISTRATION_INVITE_REQUIRED = 'REGISTRATION_INVITE_REQUIRED';
const REGISTRATION_ADMIN_ONLY = 'REGISTRATION_ADMIN_ONLY';
const INVALID_PROJECT_INVITE = 'INVALID_PROJECT_INVITE';

function dispatchVerificationEmail(userId: string) {
  import('@/lib/auth/email-verification')
    .then(({ issueEmailVerificationToken }) => issueEmailVerificationToken(userId))
    .catch((err) => {
      console.error('[signup] verification email dispatch failed:', err);
    });
}

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password, inviteToken, projectInviteToken } = body;
    const email = normalizeEmail(body.email);

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const registrationPolicy = await getRegistrationPolicy();
    const hasProjectInviteToken =
      typeof projectInviteToken === 'string' && projectInviteToken.trim().length > 0;
    let projectInviteUsable = false;

    if (hasProjectInviteToken) {
      projectInviteUsable = await isProjectInviteLinkUsable(projectInviteToken);
      if (!projectInviteUsable) {
        return NextResponse.json(
          { error: INVALID_PROJECT_INVITE, code: INVALID_PROJECT_INVITE },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // Allow invited users to complete signup by setting their password
      if (existingUser.status === 'invited' && !existingUser.password) {
        if (
          !isValidInviteToken(
            inviteToken,
            existingUser.inviteTokenHash,
            existingUser.inviteTokenExpiresAt
          )
        ) {
          return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [updatedUser] = await db
          .update(users)
          .set({
            name,
            password: hashedPassword,
            status: 'active',
            inviteTokenHash: null,
            inviteTokenExpiresAt: null,
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        if (!updatedUser) {
          throw new Error('Failed to activate user');
        }

        // Activate any pending org memberships
        await db
          .update(organizationMembers)
          .set({ status: 'active' })
          .where(
            and(
              eq(organizationMembers.userId, existingUser.id),
              eq(organizationMembers.status, 'invited')
            )
          );

        dispatchVerificationEmail(updatedUser.id);

        return NextResponse.json(
          {
            message: 'Account activated successfully',
            user: {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
            },
          },
          { status: 201 }
        );
      }

      // Don't leak account existence to callers. Introduce a small random
      // delay so timing doesn't reveal the duplicate branch either.
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
      return NextResponse.json({ message: GENERIC_SIGNUP_MESSAGE }, { status: 200 });
    }

    if (registrationPolicy.mode === 'invite_only' && !projectInviteUsable) {
      return NextResponse.json(
        { error: REGISTRATION_INVITE_REQUIRED, code: REGISTRATION_INVITE_REQUIRED },
        { status: 403 }
      );
    }

    if (registrationPolicy.mode === 'admin_created_only') {
      return NextResponse.json(
        { error: REGISTRATION_ADMIN_ONLY, code: REGISTRATION_ADMIN_ONLY },
        { status: 403 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (projectInviteUsable) {
      try {
        const result = await createUserWithProjectInviteLink({
          name,
          email,
          passwordHash: hashedPassword,
          token: projectInviteToken,
        });

        dispatchVerificationEmail(result.user.id);

        return NextResponse.json(
          {
            message: 'User created successfully',
            user: result.user,
            projectInvite: result.invite,
          },
          { status: 201 }
        );
      } catch (error) {
        if (error instanceof ProjectInviteLinkError) {
          return NextResponse.json(
            { error: INVALID_PROJECT_INVITE, code: INVALID_PROJECT_INVITE },
            { status: 400 }
          );
        }
        throw error;
      }
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        status: 'active',
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    // Fire-and-forget verification email. Dynamic import keeps this path
    // cheap when SMTP is unconfigured; errors are logged, not surfaced to
    // the caller so signup always succeeds.
    dispatchVerificationEmail(newUser.id);

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isValidInviteToken(
  token: unknown,
  storedHash: string | null | undefined,
  expiresAt: Date | string | null | undefined
): boolean {
  if (typeof token !== 'string' || !token || !storedHash || !expiresAt) {
    return false;
  }
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return false;
  }

  const actual = Buffer.from(hashInviteToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
