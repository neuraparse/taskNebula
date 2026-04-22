import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Static files and Next.js internals - skip middleware
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline'
  ) {
    return NextResponse.next();
  }

  // Setup page and setup API are always accessible
  if (pathname === '/setup' || pathname === '/api/setup') {
    return NextResponse.next();
  }

  // Landing page is public
  if (pathname === '/' || pathname.startsWith('/share/')) {
    return NextResponse.next();
  }

  // API routes are handled separately
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Public auth routes
  const publicRoutes = [
    '/auth/signin',
    '/auth/signup',
    '/auth/error',
    '/auth/verify-request',
    '/auth/verify-email',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/share/');

  // Redirect to signin if not logged in and trying to access protected route
  if (!isLoggedIn && !isPublicRoute) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to dashboard if logged in and trying to access auth pages
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
