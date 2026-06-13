'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IntakeFieldDefinition } from '@tasknebula/db';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  slug: string;
  fields: IntakeFieldDefinition[];
  requiresCaptcha: boolean;
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; issueKey: string }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string> };

/**
 * Public form renderer. Each field type maps to a single shadcn primitive.
 * We deliberately keep the markup flat — no React Hook Form / Zod on the
 * client side — because the server-side validator is the source of truth
 * and the form is short-lived (one submission per visitor).
 */
export function PublicIntakeForm({ slug, fields, requiresCaptcha }: Props) {
  const t = useTranslations('planning');
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'submitting' });

    try {
      const response = await fetch(`/api/public/intake/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: values }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        issueKey?: string;
        issues?: Array<{ field: string; message: string }>;
      };

      if (!response.ok) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of data.issues ?? []) {
          fieldErrors[issue.field] = issue.message;
        }
        setState({
          kind: 'error',
          message: data.error ?? t('submission_failed'),
          fieldErrors,
        });
        return;
      }

      setState({ kind: 'success', issueKey: data.issueKey ?? '' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : t('network_error'),
      });
    }
  }

  if (state.kind === 'success') {
    return (
      <div className="border-border bg-card space-y-3 rounded-md border p-6 text-center">
        <div className="flex justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
        </div>
        <h2 className="text-foreground text-lg font-medium">{t('thanks_submission')}</h2>
        {state.issueKey ? (
          <p className="text-muted-foreground text-sm">
            {t('tracking_key')}{' '}
            <code className="bg-muted text-foreground rounded px-1.5 py-0.5">{state.issueKey}</code>
          </p>
        ) : null}
      </div>
    );
  }

  const fieldError = (name: string): string | undefined =>
    state.kind === 'error' ? state.fieldErrors?.[name] : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={`field-${field.name}`}>
            {field.label}
            {field.required ? <span className="text-destructive ml-1">*</span> : null}
          </Label>

          {field.type === 'textarea' ? (
            <Textarea
              id={`field-${field.name}`}
              name={field.name}
              value={values[field.name] ?? ''}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              rows={5}
            />
          ) : field.type === 'select' ? (
            <Select value={values[field.name] ?? ''} onValueChange={(v) => setValue(field.name, v)}>
              <SelectTrigger id={`field-${field.name}`}>
                <SelectValue placeholder={field.placeholder ?? t('select_option')} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === 'file' ? (
            // File support is currently a URL-reference field — the
            // upload pipeline issues a public URL that the visitor can
            // paste here. A full multipart upload widget can replace
            // this without changing the server contract.
            <Input
              id={`field-${field.name}`}
              name={field.name}
              type="url"
              value={values[field.name] ?? ''}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder ?? 'https://...'}
              required={field.required}
            />
          ) : (
            <Input
              id={`field-${field.name}`}
              name={field.name}
              type={field.type === 'email' ? 'email' : 'text'}
              value={values[field.name] ?? ''}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}

          {field.helpText ? (
            <p className="text-muted-foreground text-xs">{field.helpText}</p>
          ) : null}
          {fieldError(field.name) ? (
            <p className="text-destructive text-xs">{fieldError(field.name)}</p>
          ) : null}
        </div>
      ))}

      {requiresCaptcha ? (
        <p className="text-muted-foreground text-xs">{t('captcha_notice')}</p>
      ) : null}

      {state.kind === 'error' && !state.fieldErrors ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <Button type="submit" disabled={state.kind === 'submitting'} className="w-full">
        {state.kind === 'submitting' ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
