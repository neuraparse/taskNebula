import type { IntakeFieldDefinition } from '@/api/types';

export type PublicIntakeFieldValues = Record<string, string>;
export type PublicIntakeFieldErrors = Record<string, string>;

export const PUBLIC_INTAKE_FIELD_LIMITS = {
  text: 1_000,
  textarea: 10_000,
  file: 2_000,
} as const;

export interface PublicIntakeValidationMessages {
  required: string;
  email: string;
  select: string;
  maxLength: string;
}

export function canRenderNativePublicIntakeField(field: IntakeFieldDefinition): boolean {
  return (
    field.type === 'text' ||
    field.type === 'textarea' ||
    field.type === 'email' ||
    field.type === 'select' ||
    field.type === 'file'
  );
}

export function initialPublicIntakeValues(
  fields: IntakeFieldDefinition[],
): PublicIntakeFieldValues {
  return Object.fromEntries(fields.map((field) => [field.name, '']));
}

export function validatePublicIntakeFields(
  fields: IntakeFieldDefinition[],
  values: PublicIntakeFieldValues,
  messages: PublicIntakeValidationMessages,
): PublicIntakeFieldErrors {
  const next: PublicIntakeFieldErrors = {};
  for (const field of fields) {
    const value = values[field.name]?.trim() ?? '';
    if (field.required && !value) {
      next[field.name] = messages.required;
      continue;
    }
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      next[field.name] = messages.email;
      continue;
    }
    if (
      field.type === 'select' &&
      value &&
      field.options?.length &&
      !field.options.includes(value)
    ) {
      next[field.name] = messages.select;
      continue;
    }
    if (field.type === 'text' && value.length > PUBLIC_INTAKE_FIELD_LIMITS.text) {
      next[field.name] = messages.maxLength;
      continue;
    }
    if (field.type === 'textarea' && value.length > PUBLIC_INTAKE_FIELD_LIMITS.textarea) {
      next[field.name] = messages.maxLength;
      continue;
    }
    if (field.type === 'file' && value.length > PUBLIC_INTAKE_FIELD_LIMITS.file) {
      next[field.name] = messages.maxLength;
    }
  }
  return next;
}

export function publicIntakeSubmitPayload(
  fields: IntakeFieldDefinition[],
  values: PublicIntakeFieldValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name]?.trim();
    if (value) payload[field.name] = value;
  }
  return payload;
}
