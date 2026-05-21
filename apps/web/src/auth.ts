import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { db, users } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { consumeSamlExchangeToken } from '@/lib/sso/session';

/**
 * Full auth configuration with database operations
 * This file extends auth.config.ts with Node.js-only features
 */
const nextAuth = NextAuth({
  ...authConfig,
  providers: [
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
    // Include OAuth providers from config
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
});

export const handlers = nextAuth.handlers;
export const signIn: typeof nextAuth.signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = nextAuth.auth;
