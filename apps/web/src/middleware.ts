import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from './auth.config';
import {
  LOCALE_COOKIE,
  defaultLocale,
  isSupportedLocale,
  matchLocaleFromAcceptLanguage,
} from './lib/i18n/config';

const { auth } = NextAuth(authConfig);

// Routes that are explicitly served from the top-level (no /[locale]/ prefix).
// These match the directory structure under apps/web/src/app/.
const UN_LOCALIZED_PREFIXES = [
  '/api',
  '/auth',
  '/join',
  '/share',
  '/setup',
  '/offline',
  '/ai-model-cards',
  '/intake',
  '/trust',
];

function isUnLocalizedPath(pathname: string): boolean {
  return UN_LOCALIZED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

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

  // API routes never get locale handling. Boundary check matters: a naive
  // `startsWith('/api')` would also swallow `/api-docs`, `/api-keys`, etc.,
  // sending them straight to the Next router without next-intl's rewrite —
  // which then fails to match because those pages live under
  // `[locale]/(app)/...`. Match only the actual `/api` segment.
  if (pathname === '/api' || pathname.startsWith('/api/')) {
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

  if (!isLoggedIn && !isPublicAuthRoute && !isUnLocalizedPath(pathWithoutLocale)) {
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

  // Everything else (dashboard, projects, settings, …) lives under
  // app/[locale]. Preserve unprefixed URLs such as /dashboard by rewriting
  // them internally to the active locale route. Explicit localized URLs
  // (/tr/dashboard, /de/projects, …) are already concrete app routes.
  // Locale resolution order: an explicit URL prefix or a previously chosen
  // cookie always wins; otherwise negotiate from the device/browser
  // `Accept-Language` header, then fall back to the default.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const hasCookieLocale = isSupportedLocale(cookieLocale);
  const resolvedLocale: string = hasLocalePrefix
    ? firstSegment
    : isSupportedLocale(cookieLocale)
      ? cookieLocale
      : (matchLocaleFromAcceptLanguage(request.headers.get('accept-language')) ?? defaultLocale);

  // Forward the resolved locale to server components as a REQUEST header.
  // This app uses a custom middleware (not next-intl's createMiddleware), so
  // next-intl's `requestLocale` isn't populated — `request.ts` reads this
  // header to load the correct catalog for getMessages()/getTranslations().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tasknebula-locale', resolvedLocale);

  if (hasLocalePrefix) {
    return applyHtmlAttrs(
      NextResponse.next({ request: { headers: requestHeaders } }),
      resolvedLocale
    );
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/${resolvedLocale}${pathWithoutLocale}`;
  const response = applyHtmlAttrs(
    NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }),
    resolvedLocale
  );
  // Persist a device-detected locale so subsequent navigation is stable and
  // the language switcher reflects it. Only set it when the visitor hasn't
  // explicitly chosen one — an explicit pick (cookie) must always win.
  if (!hasCookieLocale) {
    response.cookies.set(LOCALE_COOKIE, resolvedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }
  return response;
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
