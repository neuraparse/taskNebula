import { z } from 'zod';
import type { IntakeFieldDefinition, IntakeFieldType } from '@tasknebula/db';

const FIELD_TYPES: readonly IntakeFieldType[] = [
  'text',
  'textarea',
  'email',
  'select',
  'file',
] as const;

/**
 * Schema for an admin-supplied field definition. Tight enough to keep
 * the form renderer simple but lenient on optional metadata.
 */
export const intakeFieldDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    // Field names map to payload keys, so keep them URL/JSON-safe.
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'name must be a valid identifier'),
  label: z.string().min(1).max(200),
  type: z.enum(FIELD_TYPES as [IntakeFieldType, ...IntakeFieldType[]]),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1).max(200)).optional(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
});

export const intakeFieldsArraySchema = z
  .array(intakeFieldDefinitionSchema)
  .max(40, 'A single form supports at most 40 fields')
  .refine(
    (fields) => {
      const names = new Set<string>();
      for (const f of fields) {
        if (names.has(f.name)) return false;
        names.add(f.name);
      }
      return true;
    },
    { message: 'Field names must be unique within a form' },
  );

export interface FieldValidationIssue {
  field: string;
  message: string;
}

/**
 * Validate a submitted payload against the form's field definitions.
 *
 * Rules:
 *   - Required fields must have a non-empty value (string trimmed).
 *   - `email` fields, when present, must look like an email.
 *   - `select` fields, when present, must be one of the declared options.
 *   - `file` fields hold an opaque attachment reference (string URL or
 *     id); we only enforce required/non-empty here. Actual upload
 *     handling is delegated to the existing uploads endpoint.
 *
 * Returns `{ ok: true, value }` with a cleaned payload (unknown keys
 * stripped), or `{ ok: false, issues }`.
 */
export function validateSubmission(
  fields: IntakeFieldDefinition[],
  payload: unknown,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; issues: FieldValidationIssue[] } {
  const issues: FieldValidationIssue[] = [];
  const value: Record<string, unknown> = {};

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, issues: [{ field: '_root', message: 'Payload must be an object' }] };
  }

  const input = payload as Record<string, unknown>;

  for (const field of fields) {
    const raw = input[field.name];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '');

    if (field.required && isEmpty) {
      issues.push({ field: field.name, message: 'This field is required' });
      continue;
    }
    if (isEmpty) continue;

    if (field.type === 'email') {
      if (typeof raw !== 'string') {
        issues.push({ field: field.name, message: 'Must be a string' });
        continue;
      }
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
      if (!ok) {
        issues.push({ field: field.name, message: 'Must be a valid email' });
        continue;
      }
      value[field.name] = raw.trim();
      continue;
    }

    if (field.type === 'select') {
      if (typeof raw !== 'string') {
        issues.push({ field: field.name, message: 'Must be a string' });
        continue;
      }
      const opts = field.options ?? [];
      if (opts.length > 0 && !opts.includes(raw)) {
        issues.push({ field: field.name, message: 'Not a valid option' });
        continue;
      }
      value[field.name] = raw;
      continue;
    }

    if (field.type === 'text' || field.type === 'textarea') {
      if (typeof raw !== 'string') {
        issues.push({ field: field.name, message: 'Must be a string' });
        continue;
      }
      // Soft cap to keep payloads sane.
      const max = field.type === 'textarea' ? 10_000 : 1_000;
      if (raw.length > max) {
        issues.push({ field: field.name, message: `Maximum ${max} characters` });
        continue;
      }
      value[field.name] = raw;
      continue;
    }

    if (field.type === 'file') {
      // File fields carry an opaque reference (URL, id, base64 ref).
      // The renderer is responsible for producing a string; deeper
      // validation belongs to the upload pipeline.
      if (typeof raw !== 'string') {
        issues.push({ field: field.name, message: 'Must be a string reference' });
        continue;
      }
      if (raw.length > 2_000) {
        issues.push({ field: field.name, message: 'Reference too long' });
        continue;
      }
      value[field.name] = raw;
      continue;
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, value };
}

/**
 * Derive a human-readable title for the auto-created issue. Picks the
 * first non-empty text-like field, otherwise falls back to the form
 * title. Always trimmed and capped to fit `issues.title` (varchar 500).
 */
export function deriveIssueTitle(
  fields: IntakeFieldDefinition[],
  payload: Record<string, unknown>,
  fallbackTitle: string,
): string {
  for (const field of fields) {
    if (field.type !== 'text' && field.type !== 'textarea') continue;
    const raw = payload[field.name];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().slice(0, 500);
    }
  }
  return fallbackTitle.slice(0, 500);
}

/**
 * Build a markdown body that mirrors the submission. Keeps formatting
 * simple — one section per field. Helps the triager skim without
 * cross-referencing the intake submission record.
 */
export function buildIssueDescription(
  fields: IntakeFieldDefinition[],
  payload: Record<string, unknown>,
  meta: { formTitle: string; submittedByEmail?: string | null },
): string {
  const lines: string[] = [];
  lines.push(`Submitted via intake form: **${meta.formTitle}**`);
  if (meta.submittedByEmail) {
    lines.push(`Submitter: ${meta.submittedByEmail}`);
  }
  lines.push('');
  for (const field of fields) {
    const raw = payload[field.name];
    if (raw === undefined || raw === null || raw === '') continue;
    lines.push(`### ${field.label}`);
    lines.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
    lines.push('');
  }
  return lines.join('\n');
}
