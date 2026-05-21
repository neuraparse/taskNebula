// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Default `next-intl` mock — keeps tests that render translated components
// from needing a `NextIntlClientProvider` wrapper. Individual tests can
// still call `jest.mock('next-intl', …)` to override.
const enMessages = require('./messages/en.json');

function resolveByPath(messages, key) {
  return key.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return acc[part];
    return undefined;
  }, messages);
}

function interpolate(value, values) {
  if (typeof value !== 'string' || !values) return value;
  let out = value;
  for (const [k, v] of Object.entries(values)) {
    out = out.replace(new RegExp(`{${k}}`, 'g'), String(v));
  }
  return out;
}

jest.mock('next-intl', () => {
  return {
    __esModule: true,
    NextIntlClientProvider: ({ children }) => children,
    useTranslations: (namespace) => (key, values) => {
      const composite = namespace ? `${namespace}.${key}` : key;
      const resolved = resolveByPath(enMessages, composite);
      if (typeof resolved === 'string') return interpolate(resolved, values);
      return key;
    },
    useLocale: () => 'en',
    useFormatter: () => ({
      dateTime: (value) => new Date(value).toString(),
      number: (value) => String(value),
      relativeTime: (value) => String(value),
    }),
  };
});

// Default App Router mock for client component tests. Individual tests can
// still provide their own next/navigation mock when they need mutable query
// strings or to assert router calls.
jest.mock('next/navigation', () => {
  const searchParams = new URLSearchParams();
  return {
    __esModule: true,
    redirect: jest.fn((path) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    }),
    notFound: jest.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
    usePathname: () => '/',
    useRouter: () => ({
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      push: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
    }),
    useSearchParams: () => searchParams,
  };
});

// Radix' DirectionProvider should not blow up in JSDOM. Mock to a passthrough.
jest.mock('@radix-ui/react-direction', () => ({
  __esModule: true,
  DirectionProvider: ({ children }) => children,
  useDirection: () => 'ltr',
}));

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = jest.fn();
}

if (typeof HTMLMediaElement !== 'undefined') {
  if (!HTMLMediaElement.prototype.play) {
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  } else {
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  }

  if (!HTMLMediaElement.prototype.pause) {
    HTMLMediaElement.prototype.pause = jest.fn();
  } else {
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  }

  if (!HTMLMediaElement.prototype.load) {
    HTMLMediaElement.prototype.load = jest.fn();
  }
}

global.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined') {
  window.IS_REACT_ACT_ENVIRONMENT = true;
}
