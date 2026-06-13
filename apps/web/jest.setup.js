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

// Minimal ICU MessageFormat evaluator so tests resolve plural/select/# and
// simple {var} interpolation the same way next-intl would at runtime.
function parseBranches(body) {
  const out = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    let key = '';
    while (i < body.length && body[i] !== '{') {
      key += body[i];
      i++;
    }
    if (body[i] !== '{') break;
    let depth = 1;
    let j = i + 1;
    while (j < body.length && depth > 0) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}') depth--;
      if (depth === 0) break;
      j++;
    }
    out[key.trim()] = body.slice(i + 1, j);
    i = j + 1;
  }
  return out;
}

function evalArg(inner, values) {
  const firstComma = inner.indexOf(',');
  if (firstComma === -1) {
    const name = inner.trim();
    return name in values ? String(values[name]) : `{${name}}`;
  }
  const argName = inner.slice(0, firstComma).trim();
  const rest = inner.slice(firstComma + 1).trim();
  const secondComma = rest.indexOf(',');
  const type = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim();
  const branchBody = secondComma === -1 ? '' : rest.slice(secondComma + 1).trim();
  if (type !== 'plural' && type !== 'select' && type !== 'selectordinal') {
    return argName in values ? String(values[argName]) : `{${argName}}`;
  }
  const branches = parseBranches(branchBody);
  const val = values[argName];
  let chosen;
  if (type === 'select') {
    chosen = branches[String(val)] ?? branches.other;
  } else {
    chosen = branches[`=${val}`] ?? branches[Number(val) === 1 ? 'one' : 'other'] ?? branches.other;
  }
  if (chosen == null) return '';
  return interpolate(chosen.replace(/#/g, String(val)), values);
}

function interpolate(value, values) {
  if (typeof value !== 'string') return value;
  const vals = values || {};
  let result = '';
  let i = 0;
  while (i < value.length) {
    if (value[i] === '{') {
      let depth = 1;
      let j = i + 1;
      while (j < value.length && depth > 0) {
        if (value[j] === '{') depth++;
        else if (value[j] === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      result += evalArg(value.slice(i + 1, j), vals);
      i = j + 1;
    } else {
      result += value[i];
      i++;
    }
  }
  return result;
}

// Shared translator builder used by both the `next-intl` (client) and
// `next-intl/server` mocks so server components calling `getTranslations`
// behave the same as client components calling `useTranslations`.
function buildT(namespace) {
  const lookup = (key) => resolveByPath(enMessages, namespace ? `${namespace}.${key}` : key);
  const t = (key, values) => {
    const resolved = lookup(key);
    if (typeof resolved === 'string') return interpolate(resolved, values);
    return key;
  };
  // `t.rich` returns React nodes: plain text stays a string, and
  // `<tag>inner</tag>` segments invoke the matching render fn from `values`.
  t.rich = (key, values) => {
    const resolved = lookup(key);
    if (typeof resolved !== 'string') return key;
    const React = require('react');
    const nodes = [];
    const re = /<(\w+)>([\s\S]*?)<\/\1>|([\s\S]+?)(?=<\w+>|$)/g;
    let m;
    let i = 0;
    while ((m = re.exec(resolved)) !== null) {
      if (m[1]) {
        const fn = values && values[m[1]];
        const inner = interpolate(m[2], values);
        nodes.push(React.createElement(React.Fragment, { key: i++ }, fn ? fn(inner) : inner));
      } else if (m[3]) {
        nodes.push(React.createElement(React.Fragment, { key: i++ }, interpolate(m[3], values)));
      }
    }
    return nodes;
  };
  t.markup = (key, values) => {
    const resolved = lookup(key);
    return typeof resolved === 'string' ? interpolate(resolved, values) : key;
  };
  t.raw = (key) => lookup(key);
  t.has = (key) => typeof lookup(key) === 'string';
  return t;
}

const mockFormatter = {
  dateTime: (value) => new Date(value).toString(),
  number: (value) => String(value),
  relativeTime: (value) => String(value),
};

jest.mock('next-intl', () => {
  return {
    __esModule: true,
    NextIntlClientProvider: ({ children }) => children,
    useTranslations: (namespace) => buildT(namespace),
    useLocale: () => 'en',
    useMessages: () => enMessages,
    useFormatter: () => mockFormatter,
  };
});

// `next-intl/server` is ESM-only and not transformed by jest; mock it so async
// server components that call getTranslations()/getLocale() work in tests.
jest.mock('next-intl/server', () => ({
  __esModule: true,
  getTranslations: async (arg) => buildT(typeof arg === 'string' ? arg : arg && arg.namespace),
  getLocale: async () => 'en',
  getMessages: async () => enMessages,
  getFormatter: async () => mockFormatter,
  getNow: async () => new Date(0),
  getTimeZone: async () => 'UTC',
  setRequestLocale: () => {},
}));

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
