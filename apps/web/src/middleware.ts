import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from './auth.config';
import {
  LOCALE_COOKIE,
  defaultLocale,
  isSupportedLocale,
  locales,
} from './lib/i18n/config';

const { auth } = NextAuth(authConfig);

// Routes that are explicitly served from the top-level (no /[locale]/ prefix).
// These match the directory structure under apps/web/src/app/.
const UN_LOCALIZED_PREFIXES = ['/api', '/auth', '/share', '/setup', '/offline'];

function isUnLocalizedPath(pathname: string): boolean {
  return UN_LOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  // Existing routes like `/dashboard` should keep working; next-intl will
  // rewrite them to `/{defaultLocale}/dashboard` internally without changing
  // the visible URL. Localized URLs (`/tr/dashboard`) still work explicitly.
  localePrefix: 'as-needed',
  localeCookie: {
    name: LOCALE_COOKIE,
  },
});

function applyHtmlAttrs(response: NextResponse, locale: string): NextResponse {
  // Surface the resolved locale to client/server components via a request
  // header — useful for components that need locale without re-running the
  // next-intl resolver (e.g. the root layout sets <html lang>).
  response.headers.set('x-tasknebula-locale', locale);
  return response;
}

export default auth((req) => {
  const request = req as unknown as NextRequest;
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!(req as unknown as { auth?: unknown }).auth;

  // Static files and Next.js internals - skip middleware entirely.
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

  // Setup page and setup API are always accessible.
  if (pathname === '/setup' || pathname === '/api/setup') {
    return NextResponse.next();
  }

  // Un-localized public routes (landing page lives at the root and is also
  // not under a [locale] segment for now).
  if (pathname === '/' || pathname.startsWith('/share/')) {
    return NextResponse.next();
  }

  // API routes never get locale handling.
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Public auth routes (un-localized for now; see lib/i18n/MIGRATION.md).
  const publicAuthRoutes = [
    '/auth/signin',
    '/auth/signup',
    '/auth/error',
    '/auth/verify-request',
    '/auth/verify-email',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  const isPublicAuthRoute = publicAuthRoutes.includes(pathname);

  // Redirect to signin if not logged in and trying to access protected route.
  // We strip any leading /[locale] segment before checking auth status so the
  // redirect target is locale-agnostic.
  const firstSegment = pathname.split('/')[1];
  const hasLocalePrefix = isSupportedLocale(firstSegment);
  const pathWithoutLocale = hasLocalePrefix
    ? pathname.slice(`/${firstSegment}`.length) || '/'
    : pathname;

  if (
    !isLoggedIn &&
    !isPublicAuthRoute &&
    !isUnLocalizedPath(pathWithoutLocale)
  ) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isLoggedIn && isPublicAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Auth routes themselves are not run through the intl middleware.
  if (isUnLocalizedPath(pathname)) {
    return NextResponse.next();
  }

  // Everything else (dashboard, projects, settings, …) flows through the
  // next-intl middleware so it can attach the proper locale to the request.
  const intlResponse = intlMiddleware(request);
  const resolvedLocale = hasLocalePrefix
    ? firstSegment
    : request.cookies.get(LOCALE_COOKIE)?.value || defaultLocale;
  return applyHtmlAttrs(intlResponse, resolvedLocale);
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
