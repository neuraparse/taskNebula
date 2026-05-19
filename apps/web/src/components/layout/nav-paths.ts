const LOCALE_PREFIX_PATTERN = /^\/[a-z]{2}(?=\/|$)/;

// Keep sidebar and rail route checks locale-agnostic. next-intl may surface
// either `/dashboard` or `/tr/dashboard` depending on the selected locale.
export function stripLocalePrefix(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  return pathname.replace(LOCALE_PREFIX_PATTERN, '') || '/';
}
