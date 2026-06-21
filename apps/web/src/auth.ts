import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { db, users } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { consumeSamlExchangeToken } from '@/lib/sso/session';
import { getLoginOAuthCredentials, isLoginOAuthProvider } from '@/lib/auth/login-oauth-providers';
import { applyOAuthDatabaseUser, resolveOAuthDatabaseUser } from '@/lib/auth/oauth-users';

/**
 * Full auth configuration with database operations
 * This file extends auth.config.ts with Node.js-only features
 */
function buildCredentialProviders(): NextAuthConfig['providers'] {
  return [
    // Override Credentials provider with actual authorize logic
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.password || user.status !== 'active') {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    // SAML bridge: redeems a one-shot exchange token minted by the ACS
    // callback (see apps/web/src/lib/sso/session.ts) and signs the user in.
    Credentials({
      id: 'saml-bridge',
      name: 'saml-bridge',
      credentials: {
        token: { label: 'SAML exchange token', type: 'text' },
      },
      async authorize(credentials) {
        const token = credentials?.token;
        if (typeof token !== 'string' || !token) return null;
        const payload = await consumeSamlExchangeToken(token);
        if (!payload) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.id, payload.userId),
        });
        if (!user || user.status !== 'active') return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ];
}

async function buildNodeProviders(): Promise<NextAuthConfig['providers']> {
  const providers = buildCredentialProviders();
  const credentials = await getLoginOAuthCredentials();

  if (credentials.github) {
    providers.push(
      GitHub({
        clientId: credentials.github.clientId,
        clientSecret: credentials.github.clientSecret,
      })
    );
  }

  if (credentials.google) {
    providers.push(
      Google({
        clientId: credentials.google.clientId,
        clientSecret: credentials.google.clientSecret,
      })
    );
  }

  return providers;
}

async function buildNodeAuthConfig(): Promise<NextAuthConfig> {
  const baseCallbacks = authConfig.callbacks ?? {};

  return {
    ...authConfig,
    callbacks: {
      ...(authConfig.callbacks ?? {}),
      async signIn({ user, account }) {
        if (!isLoginOAuthProvider(account?.provider)) {
          return true;
        }

        const databaseUser = await resolveOAuthDatabaseUser({ user, account });
        if (!databaseUser) return false;
        applyOAuthDatabaseUser(user, databaseUser);
        return true;
      },
      async jwt(params) {
        if (params.user && isLoginOAuthProvider(params.account?.provider)) {
          const databaseUser = await resolveOAuthDatabaseUser({
            user: params.user,
            account: params.account,
          });
          if (databaseUser) {
            applyOAuthDatabaseUser(params.user, databaseUser);
          }
        }

        return baseCallbacks.jwt ? baseCallbacks.jwt(params) : params.token;
      },
    },
    providers: await buildNodeProviders(),
  };
}

const handlerAuth = NextAuth(async () => buildNodeAuthConfig());
const sessionAuth = NextAuth(authConfig);

export const handlers = handlerAuth.handlers;
export const signIn: typeof handlerAuth.signIn = handlerAuth.signIn;
export const signOut = handlerAuth.signOut;
export const auth = sessionAuth.auth;
