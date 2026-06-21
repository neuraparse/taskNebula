import { createId } from '@paralleldrive/cuid2';
import { accounts, db, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { isLoginOAuthProvider, type LoginOAuthProvider } from '@/lib/auth/login-oauth-providers';
import { getRegistrationPolicy } from '@/lib/auth/registration-policy';

type OAuthUserInput = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

type OAuthAccountInput = {
  type?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
};

type OAuthDatabaseUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  status: 'active' | 'inactive' | 'invited';
};

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toOAuthDatabaseUser(row: unknown): OAuthDatabaseUser | null {
  if (!row || typeof row !== 'object') return null;

  const candidate = row as Partial<OAuthDatabaseUser>;
  const status = candidate.status;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.email !== 'string' ||
    (status !== 'active' && status !== 'inactive' && status !== 'invited')
  ) {
    return null;
  }

  return {
    id: candidate.id,
    email: candidate.email,
    name: typeof candidate.name === 'string' ? candidate.name : null,
    image: typeof candidate.image === 'string' ? candidate.image : null,
    status,
  };
}

async function findUserByEmail(email: string): Promise<OAuthDatabaseUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  return toOAuthDatabaseUser(user);
}

async function findLinkedOAuthUser(
  provider: LoginOAuthProvider,
  providerAccountId: string
): Promise<OAuthDatabaseUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      status: users.status,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
    .limit(1);

  return toOAuthDatabaseUser(row);
}

async function insertOAuthAccount(
  userId: string,
  provider: LoginOAuthProvider,
  providerAccountId: string,
  account: OAuthAccountInput
) {
  await db
    .insert(accounts)
    .values({
      userId,
      type: nullableText(account.type) ?? 'oauth',
      provider,
      providerAccountId,
      refresh_token: nullableText(account.refresh_token),
      access_token: nullableText(account.access_token),
      expires_at: nullableNumber(account.expires_at),
      token_type: nullableText(account.token_type),
      scope: nullableText(account.scope),
      id_token: nullableText(account.id_token),
      session_state: nullableText(account.session_state),
    })
    .onConflictDoNothing();
}

async function createOAuthUser(user: OAuthUserInput, email: string) {
  const [created] = await db
    .insert(users)
    .values({
      id: createId(),
      email,
      name: nullableText(user.name),
      image: nullableText(user.image),
      status: 'active',
    })
    .onConflictDoNothing()
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      status: users.status,
    });

  return toOAuthDatabaseUser(created) ?? findUserByEmail(email);
}

export async function resolveOAuthDatabaseUser({
  user,
  account,
}: {
  user: OAuthUserInput;
  account: OAuthAccountInput | null | undefined;
}): Promise<OAuthDatabaseUser | null> {
  if (!account) return null;

  const provider = account?.provider;
  if (!isLoginOAuthProvider(provider)) return null;

  const providerAccountId = normalizeText(account?.providerAccountId);
  const email = normalizeEmail(user.email);
  if (!providerAccountId || !email) return null;

  const linkedUser = await findLinkedOAuthUser(provider, providerAccountId);
  if (linkedUser) {
    return linkedUser.status === 'active' ? linkedUser : null;
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    if (existingUser.status !== 'active') return null;
    await insertOAuthAccount(existingUser.id, provider, providerAccountId, account);
    return existingUser;
  }

  const registrationPolicy = await getRegistrationPolicy();
  if (registrationPolicy.mode !== 'allow_registration') {
    return null;
  }

  const createdUser = await createOAuthUser(user, email);
  if (!createdUser || createdUser.status !== 'active') return null;

  await insertOAuthAccount(createdUser.id, provider, providerAccountId, account);
  return createdUser;
}

export function applyOAuthDatabaseUser(authUser: OAuthUserInput, databaseUser: OAuthDatabaseUser) {
  authUser.id = databaseUser.id;
  authUser.email = databaseUser.email;
  authUser.name = databaseUser.name;
  authUser.image = databaseUser.image;
}
