/**
 * @jest-environment node
 */

import { redactPii, rehydrate } from '../redact';

describe('redactPii — coverage per PII type', () => {
  it('redacts a plain email', () => {
    const { redacted, replacements } = redactPii('Contact alice@example.com please.');
    expect(redacted).toMatch(/^Contact \[EMAIL_[0-9a-f]{4}] please\.$/);
    expect(Array.from(replacements.values())).toContain('alice@example.com');
  });

  it('uses the same placeholder for repeated occurrences in one document', () => {
    const { redacted, replacements } = redactPii(
      'Email alice@example.com twice: alice@example.com'
    );
    const matches = redacted.match(/\[EMAIL_[0-9a-f]{4}]/g) ?? [];
    expect(matches.length).toBe(2);
    expect(new Set(matches).size).toBe(1);
    expect(replacements.size).toBe(1);
  });

  it('does NOT mangle URLs that happen to contain @', () => {
    const { redacted } = redactPii('See https://example.com/path?ref=x');
    expect(redacted).toContain('https://example.com/path?ref=x');
  });

  it('redacts E.164 phone numbers', () => {
    const { redacted, replacements } = redactPii('Call +14155551234 anytime');
    expect(redacted).toMatch(/\[PHONE_[0-9a-f]{4}]/);
    expect(Array.from(replacements.values())).toContain('+14155551234');
  });

  it('redacts (xxx) xxx-xxxx style phone numbers', () => {
    const { redacted } = redactPii('Call (415) 555-0132 anytime');
    expect(redacted).toMatch(/\[PHONE_[0-9a-f]{4}]/);
  });

  it('does NOT mistake a sprint number for a phone number', () => {
    const { redacted, replacements } = redactPii('Sprint 23 closes Friday');
    expect(redacted).toBe('Sprint 23 closes Friday');
    expect(replacements.size).toBe(0);
  });

  it('redacts a Luhn-valid credit card', () => {
    // 4111 1111 1111 1111 — Visa test card, Luhn-valid.
    const { redacted, replacements } = redactPii('Pay with 4111 1111 1111 1111 today.');
    expect(redacted).toMatch(/\[CC_[0-9a-f]{4}]/);
    expect(Array.from(replacements.values())).toContain('4111 1111 1111 1111');
  });

  it('rejects a Luhn-invalid 16-digit run', () => {
    // 1234 5678 9012 3456 is not Luhn-valid → must NOT be redacted as CC.
    const { redacted } = redactPii('Ref code 1234 5678 9012 3457');
    expect(redacted).not.toMatch(/\[CC_/);
  });

  it('redacts a US SSN', () => {
    const { redacted, replacements } = redactPii('SSN 123-45-6789 on file');
    expect(redacted).toMatch(/\[SSN_[0-9a-f]{4}]/);
    expect(Array.from(replacements.values())).toContain('123-45-6789');
  });

  it('rejects an obviously-invalid SSN (000-00-0000)', () => {
    const { redacted } = redactPii('placeholder 000-00-0000');
    expect(redacted).not.toMatch(/\[SSN_/);
  });

  it('redacts a valid Turkish TC kimlik', () => {
    // 10000000146 has a valid TCKN checksum (commonly cited public test value).
    const { redacted, replacements } = redactPii('Kimlik no: 10000000146.');
    expect(redacted).toMatch(/\[TCKN_[0-9a-f]{4}]/);
    expect(Array.from(replacements.values())).toContain('10000000146');
  });

  it('rejects an 11-digit number with a bad TCKN checksum', () => {
    const { redacted } = redactPii('Random 11-digit code 12345678901');
    // Must not be tagged TCKN. (Could still be tagged PHONE if it passes the
    // phone heuristic — but it should never be TCKN.)
    expect(redacted).not.toMatch(/\[TCKN_/);
  });

  it('redacts an sk- API key', () => {
    const { redacted, replacements } = redactPii(
      'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234'
    );
    expect(redacted).toMatch(/\[APIKEY_[0-9a-f]{4}]/);
    expect([...replacements.values()][0]).toMatch(/^sk-/);
  });

  it('redacts a GitHub PAT (ghp_)', () => {
    const { redacted } = redactPii('token=ghp_abcdefghijklmnopqrstuvwxyz1234');
    expect(redacted).toMatch(/\[APIKEY_[0-9a-f]{4}]/);
  });

  it('leaves clean text alone', () => {
    const { redacted, replacements } = redactPii('Refactor the inventory module to use cursors.');
    expect(redacted).toBe('Refactor the inventory module to use cursors.');
    expect(replacements.size).toBe(0);
  });

  it('handles empty / nullish input gracefully', () => {
    expect(redactPii('').redacted).toBe('');
    expect(redactPii(undefined as unknown as string).redacted).toBe('');
  });

  it('respects the `detectors` filter', () => {
    const { redacted } = redactPii('Mail alice@example.com from +14155551234', {
      detectors: ['EMAIL'],
    });
    expect(redacted).toMatch(/\[EMAIL_/);
    expect(redacted).toContain('+14155551234');
  });
});

describe('rehydrate', () => {
  it('round-trips redact → rehydrate exactly', () => {
    const original = 'Email alice@example.com and call +14155551234.';
    const { redacted, replacements } = redactPii(original);
    expect(redacted).not.toContain('alice@example.com');
    expect(rehydrate(redacted, replacements)).toBe(original);
  });

  it('safely handles text with no placeholders', () => {
    const replacements = new Map([['[EMAIL_abcd]', 'alice@example.com']]);
    expect(rehydrate('just some text', replacements)).toBe('just some text');
  });

  it('leaves hallucinated placeholders alone', () => {
    expect(rehydrate('see [EMAIL_zzzz] and [PHONE_yyyy]', new Map())).toBe(
      'see [EMAIL_zzzz] and [PHONE_yyyy]'
    );
  });

  it('accepts a plain object instead of a Map', () => {
    expect(rehydrate('hello [EMAIL_x1]', { '[EMAIL_x1]': 'a@b.c' })).toBe('hello a@b.c');
  });
});
