/**
 * PII redaction (P1-16).
 *
 * Replaces high-confidence PII spans (emails, phone numbers, credit cards,
 * SSNs, Turkish TC kimlik, API keys) with stable, hash-derived placeholders
 * such as `[EMAIL_a1b2]` before user-supplied text is sent to an LLM. The
 * caller keeps the returned `replacements` map and runs `rehydrate()` on the
 * LLM's response so the user still sees their original values in the UI.
 *
 * Design notes
 * ------------
 * - Regex-based and intentionally conservative. We prefer false negatives
 *   over false positives — quietly leaving a perfectly-formatted password in
 *   place is much less surprising than mangling a sprint number into
 *   "[CC_xxxx]". Each regex carries a Luhn / length / context check where
 *   that's easy.
 * - Placeholders are derived from a SHA-256 of the original span so the same
 *   value redacts to the same placeholder within one document (helps the
 *   LLM keep track of "the same person/email" without seeing the value).
 *   The map is _per-call_ though, so values do not leak between requests.
 * - For the Presidio "real ML" route, see the TODO at the end of this file.
 *
 * Public API
 * ----------
 *   redactPii(text, opts?) -> { redacted, replacements }
 *   rehydrate(text, replacements) -> string
 */

import { createHash } from 'crypto';

export type PiiKind =
  | 'EMAIL'
  | 'PHONE'
  | 'CC'
  | 'SSN'
  | 'TCKN'
  | 'APIKEY';

export interface RedactPiiOptions {
  /**
   * Restrict to a subset of detectors. Defaults to "all".
   * Useful when the caller knows that, say, a backlog title cannot contain
   * a TCKN and wants to avoid the (small) false-positive surface.
   */
  detectors?: PiiKind[];
  /**
   * Optional salt mixed into the placeholder hash. Lets a caller scope
   * placeholders to (workspace, request) so they aren't predictable across
   * tenants — defence-in-depth only; the placeholder itself never leaves
   * the server unless the LLM echoes it back.
   */
  salt?: string;
}

export interface RedactPiiResult {
  redacted: string;
  /** placeholder -> original value (verbatim, including any surrounding format). */
  replacements: Map<string, string>;
}

const DEFAULT_DETECTORS: PiiKind[] = ['EMAIL', 'PHONE', 'CC', 'SSN', 'TCKN', 'APIKEY'];

/**
 * Build the placeholder for a given kind + original value. Stable within a
 * single call so the LLM sees the same token for repeated mentions.
 */
function placeholderFor(kind: PiiKind, original: string, salt?: string): string {
  const hash = createHash('sha256')
    .update(salt ? `${salt}::` : '')
    .update(kind)
    .update('::')
    .update(original)
    .digest('hex')
    .slice(0, 4);
  return `[${kind}_${hash}]`;
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

// RFC-5322 is famously horrible to express in regex; this is the "good enough"
// HTML5-input shape. We require at least one dot in the domain so that things
// like `Re: foo@bar` (a header line, not an address) don't all match.
const EMAIL_RE =
  /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)+\b/g;

// E.164 (+CC plus 7..14 digits) and common North-American formats
// "(415) 555-0132", "415-555-0132", "415.555.0132". We exclude short numbers
// (< 7 digits) to avoid eating sprint/issue numbers.
const PHONE_RE =
  /(?:\+\d{1,3}[\s\-.]?)?(?:\(\d{2,4}\)[\s\-.]?|\d{2,4}[\s\-.])\d{3,4}[\s\-.]?\d{3,5}|\+\d{7,15}/g;

// Credit-card-ish: 13..19 digits, optionally with dashes / spaces every 4.
const CC_RE = /\b(?:\d[ \-]?){12,18}\d\b/g;

// US SSN with three-dash-two-dash-four form (we don't catch the bare 9-digit
// form on purpose — too easy to false-positive into a phone number).
const SSN_RE = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;

// Turkish TC kimlik: 11 digits, first digit non-zero, with a custom checksum.
const TCKN_RE = /\b[1-9]\d{10}\b/g;

// Provider API key prefixes we recognise: OpenAI (sk-…), GitHub (ghp-/ghs-),
// Anthropic (sk-ant-…), and the generic Personal Access Token pattern.
// We deliberately require a minimum length so "sk-foo" in a sentence doesn't
// match.
const APIKEY_RE =
  /\b(?:sk-(?:ant-)?[A-Za-z0-9_\-]{20,}|ghp_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|pat-[A-Za-z0-9_\-]{20,})\b/g;

// ---------------------------------------------------------------------------
// Luhn / TCKN validators (false-positive filters)
// ---------------------------------------------------------------------------

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const code = digits.charCodeAt(i) - 48;
    if (code < 0 || code > 9) return false;
    let n = code;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum > 0 && sum % 10 === 0;
}

/**
 * Turkish TC kimlik checksum.
 *   digit10 = ((odd-sum * 7) - even-sum) mod 10
 *   digit11 = (sum of first 10 digits) mod 10
 */
function tcknValid(id: string): boolean {
  if (id.length !== 11 || id.charCodeAt(0) === 48 /* '0' */) return false;
  const d: number[] = id.split('').map((c) => c.charCodeAt(0) - 48);
  if (d.length !== 11 || d.some((n) => n < 0 || n > 9)) return false;
  const odd = (d[0]! + d[2]! + d[4]! + d[6]! + d[8]!);
  const even = (d[1]! + d[3]! + d[5]! + d[7]!);
  // Per spec, the mod-10 result must be normalised to a positive remainder.
  const ten = ((odd * 7 - even) % 10 + 10) % 10;
  const eleven = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return ten === d[9] && eleven === d[10];
}

// ---------------------------------------------------------------------------
// Application loop
// ---------------------------------------------------------------------------

interface Span {
  start: number;
  end: number;
  kind: PiiKind;
  original: string;
}

/**
 * Collect non-overlapping matches in the input. Earlier passes (email,
 * apikey) take priority — if a span has already been claimed at offset X,
 * later passes skip it. This is what keeps an email's local-part digits
 * from being eaten by the phone detector.
 */
function collectSpans(text: string, detectors: PiiKind[]): Span[] {
  const claimed: boolean[] = new Array(text.length).fill(false);
  const spans: Span[] = [];

  const tryPush = (
    kind: PiiKind,
    re: RegExp,
    validator?: (raw: string) => boolean
  ) => {
    if (!detectors.includes(kind)) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Skip if any character is already claimed by an earlier (higher-priority) detector.
      let collision = false;
      for (let i = start; i < end; i++) {
        if (claimed[i]) {
          collision = true;
          break;
        }
      }
      if (collision) continue;
      if (validator && !validator(m[0])) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      spans.push({ start, end, kind, original: m[0] });
    }
  };

  // Order matters: high-confidence / structured matches first.
  tryPush('APIKEY', APIKEY_RE);
  tryPush('EMAIL', EMAIL_RE);
  tryPush('SSN', SSN_RE);
  tryPush('CC', CC_RE, (raw) => {
    const digits = raw.replace(/[\s\-]/g, '');
    return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
  });
  tryPush('TCKN', TCKN_RE, tcknValid);
  tryPush('PHONE', PHONE_RE, (raw) => {
    // At least 7 digits, no more than 15 — strips out the bare "1234567"
    // false positive but keeps "(415) 555-0132".
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  });

  spans.sort((a, b) => a.start - b.start);
  return spans;
}

export function redactPii(text: string, opts: RedactPiiOptions = {}): RedactPiiResult {
  const replacements = new Map<string, string>();
  if (!text) return { redacted: text ?? '', replacements };

  const detectors = opts.detectors ?? DEFAULT_DETECTORS;
  const spans = collectSpans(text, detectors);
  if (spans.length === 0) return { redacted: text, replacements };

  // Within a single call, the same original value should map to the same
  // placeholder so the LLM doesn't have to reason about two different
  // tokens for the same email.
  const originalToPlaceholder = new Map<string, string>();

  let out = '';
  let cursor = 0;
  for (const span of spans) {
    out += text.slice(cursor, span.start);
    const key = `${span.kind}::${span.original}`;
    let placeholder = originalToPlaceholder.get(key);
    if (!placeholder) {
      placeholder = placeholderFor(span.kind, span.original, opts.salt);
      originalToPlaceholder.set(key, placeholder);
      replacements.set(placeholder, span.original);
    }
    out += placeholder;
    cursor = span.end;
  }
  out += text.slice(cursor);

  return { redacted: out, replacements };
}

/**
 * Restore the original spans in an LLM response. Safe to call on text that
 * has no placeholders (returns it untouched). If the LLM hallucinated a
 * placeholder we did not issue, it's left in the output verbatim.
 */
export function rehydrate(
  text: string,
  replacements: Map<string, string> | Record<string, string> | null | undefined
): string {
  if (!text) return text ?? '';
  if (!replacements) return text;

  const entries: Array<[string, string]> =
    replacements instanceof Map
      ? Array.from(replacements.entries())
      : Object.entries(replacements);
  if (entries.length === 0) return text;

  // Longest placeholder first so a hypothetical `[EMAIL_aaaa]` does not get
  // partially eaten by a shorter `[EMAIL_aa]` token.
  entries.sort((a, b) => b[0].length - a[0].length);

  let out = text;
  for (const [placeholder, original] of entries) {
    if (!placeholder) continue;
    out = out.split(placeholder).join(original);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Presidio integration (TODO scaffold)
// ---------------------------------------------------------------------------
//
// TODO(P2): swap the regex pipeline above for a call to a Presidio
// microservice when one is deployed. Suggested shape:
//
//   const PRESIDIO_URL = process.env.PRESIDIO_ANALYZER_URL;
//
//   export async function redactPiiViaPresidio(text: string) {
//     if (!PRESIDIO_URL) return redactPii(text); // fallback to regex
//     const res = await fetch(`${PRESIDIO_URL}/analyze`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         text,
//         language: 'en',
//         entities: ['EMAIL_ADDRESS','PHONE_NUMBER','CREDIT_CARD','US_SSN','TR_VKN','TR_TCKN'],
//       }),
//     });
//     // Map Presidio's {start,end,entity_type} into the same Span shape used
//     // above, then run the placeholder substitution logic verbatim. The
//     // rehydrate() side stays exactly the same.
//   }
//
// Until that service is live, the regex pipeline above is the single source
// of truth. Lakera Guard would slot in next to this for the higher-fidelity
// "is this prompt-injection?" classification (see ./sandbox.ts).
