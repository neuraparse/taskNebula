import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

/**
 * Edge-compatible auth configuration
 * This file contains only the configuration that can run in Edge Runtime
 * Database operations and bcrypt are NOT included here
 */
export const authConfig: NextAuthConfig = {
  providers: [
    // Credentials provider with placeholder authorize function
    // The actual authorize logic is in auth.ts
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // This will be overridden in auth.ts
      authorize: async () => null,
    }),
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
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Public routes that don't require authentication
      const publicRoutes = [
        '/auth/signin',
        '/auth/signup',
        '/auth/error',
        '/auth/verify-request',
        '/auth/verify-email',
        '/auth/forgot-password',
        '/auth/reset-password',
      ];
      const isPublicRoute =
        publicRoutes.some((route) => pathname.startsWith(route)) || pathname.startsWith('/share/');

      // API routes are handled separately
      const isApiRoute = pathname.startsWith('/api');

      // Allow public routes and API routes
      if (isPublicRoute || isApiRoute) {
        return true;
      }

      // Require authentication for all other routes
      return isLoggedIn;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NODE_ENV === 'development',
};

export default authConfig;
