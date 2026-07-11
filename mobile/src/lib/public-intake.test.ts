import type { IntakeFieldDefinition } from '@/api/types';
import {
  canRenderNativePublicIntakeField,
  initialPublicIntakeValues,
  publicIntakeSubmitPayload,
  validatePublicIntakeFields,
} from './public-intake';

const messages = {
  required: 'required',
  email: 'email',
  select: 'select',
  maxLength: 'max',
};

describe('public intake helpers', () => {
  const fields: IntakeFieldDefinition[] = [
    {
      name: 'summary',
      label: 'Summary',
      type: 'text',
      required: true,
    },
    {
      name: 'attachment',
      label: 'Attachment',
      type: 'file',
      required: true,
    },
    {
      name: 'team',
      label: 'Team',
      type: 'select',
      options: ['Platform', 'Support'],
    },
  ];

  it('treats public file fields as native URL/reference inputs', () => {
    expect(canRenderNativePublicIntakeField(fields[1]!)).toBe(true);
    expect(initialPublicIntakeValues(fields)).toEqual({
      summary: '',
      attachment: '',
      team: '',
    });
  });

  it('validates required file references with the same required rule as web intake', () => {
    expect(
      validatePublicIntakeFields(
        fields,
        { summary: 'Login fails', attachment: '', team: 'Platform' },
        messages,
      ),
    ).toEqual({ attachment: 'required' });

    expect(
      validatePublicIntakeFields(
        fields,
        {
          summary: 'Login fails',
          attachment: 'https://files.example.com/screenshot.png',
          team: 'Platform',
        },
        messages,
      ),
    ).toEqual({});
  });

  it('builds a trimmed payload including file references', () => {
    expect(
      publicIntakeSubmitPayload(fields, {
        summary: ' Login fails ',
        attachment: ' https://files.example.com/screenshot.png ',
        team: '',
      }),
    ).toEqual({
      summary: 'Login fails',
      attachment: 'https://files.example.com/screenshot.png',
    });
  });

  it('rejects select values outside configured options', () => {
    expect(
      validatePublicIntakeFields(
        fields,
        {
          summary: 'Login fails',
          attachment: 'https://files.example.com/screenshot.png',
          team: 'Billing',
        },
        messages,
      ),
    ).toEqual({ team: 'select' });
  });

  it('mirrors the public intake server length limits for text-like references', () => {
    expect(
      validatePublicIntakeFields(
        [
          { name: 'summary', label: 'Summary', type: 'text' },
          { name: 'details', label: 'Details', type: 'textarea' },
          { name: 'attachment', label: 'Attachment', type: 'file' },
        ],
        {
          summary: 'a'.repeat(1_001),
          details: 'b'.repeat(10_001),
          attachment: 'c'.repeat(2_001),
        },
        messages,
      ),
    ).toEqual({
      summary: 'max',
      details: 'max',
      attachment: 'max',
    });
  });

  it('does not expose unknown required field types as native inputs', () => {
    expect(
      canRenderNativePublicIntakeField({
        name: 'signature',
        label: 'Signature',
        type: 'signature',
        required: true,
      }),
    ).toBe(false);
  });
});
