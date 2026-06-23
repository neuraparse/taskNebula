/**
 * Shared email-safe layout primitives.
 *
 * All email HTML in TaskNebula should compose through these helpers so the
 * visual language stays consistent (IBM Modern / Carbon-inspired typography,
 * spacing, meta tables, CTA buttons, info cards).
 *
 * Rules for email HTML:
 *   - inline styles only (no <style> tags, no classes)
 *   - table-based layout (Outlook/Gmail compatibility)
 *   - MSO VML fallback for buttons
 *   - 600px max content width, white card on #f4f4f4 page
 *
 * Merge tokens ({{x}}) are replaced by the caller's variable map downstream.
 */

export const EMAIL_FONT = '"IBM Plex Sans","Helvetica Neue",Arial,sans-serif';

export const EMAIL_COLORS = {
  // IBM Modern / Carbon palette
  brand: '#0f62fe',
  brandHover: '#0043ce',
  // Surfaces
  page: '#f4f4f4',
  card: '#ffffff',
  subtle: '#f4f4f4',
  elevated: '#ffffff',
  border: '#e0e0e0',
  // Text
  heading: '#161616',
  body: '#393939',
  muted: '#6f6f6f',
  faint: '#8d8d8d',
  // Semantic
  success: '#24a148',
  warning: '#f1c21b',
  danger: '#da1e28',
  info: '#4589ff',
} as const;

// ---------------------------------------------------------------------------
// Primary shell — branded card with kicker, heading, body and CTA.
// ---------------------------------------------------------------------------

export interface RenderShellArgs {
  kicker: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Optional sub-heading line below the main heading. */
  subheading?: string;
  /** Optional preview text shown by inbox clients before the user opens the email. */
  preheader?: string;
}

export function renderShell(args: RenderShellArgs): string {
  const { kicker, heading, subheading, body, ctaLabel, ctaUrl, preheader } = args;
  const cta =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px 0;"><tr><td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:44px;v-text-anchor:middle;width:204px;" arcsize="0%" stroke="f" fillcolor="${EMAIL_COLORS.brand}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:${EMAIL_FONT};font-size:14px;font-weight:600;">${ctaLabel} &rarr;</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${ctaUrl}" style="background:${EMAIL_COLORS.brand};color:#ffffff;display:inline-block;font-family:${EMAIL_FONT};font-size:14px;font-weight:600;line-height:1;padding:15px 18px;text-decoration:none;border-radius:0;mso-hide:all;">${ctaLabel}<span style="display:inline-block;padding-left:28px;">&rarr;</span></a>
<!--<![endif]-->
</td></tr></table>`
      : '';

  const subheadHtml = subheading
    ? `<p style="margin:0 0 16px 0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.55;color:${EMAIL_COLORS.muted};">${subheading}</p>`
    : '';

  const preheaderHtml = preheader
    ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;mso-hide:all;">${preheader}</div>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><title>TaskNebula</title></head>
<body data-email-style="ibm-modern" style="margin:0;padding:0;background-color:${EMAIL_COLORS.page};font-family:${EMAIL_FONT};color:${EMAIL_COLORS.heading};-webkit-font-smoothing:antialiased;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.page};"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="padding:0 4px 20px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="font-family:${EMAIL_FONT};color:${EMAIL_COLORS.heading};font-weight:600;font-size:18px;letter-spacing:0;">TaskNebula</td>
<td align="right" width="120"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td height="4" width="96" style="height:4px;width:96px;line-height:4px;font-size:0;background-color:${EMAIL_COLORS.brand};">&nbsp;</td></tr></table></td>
</tr></table>
</td></tr>
<tr><td style="background:${EMAIL_COLORS.card};border-top:4px solid ${EMAIL_COLORS.heading};border-right:1px solid ${EMAIL_COLORS.border};border-bottom:1px solid ${EMAIL_COLORS.border};border-left:1px solid ${EMAIL_COLORS.border};border-radius:0;padding:40px 40px 36px 40px;">
<p style="margin:0 0 12px 0;font-family:${EMAIL_FONT};color:${EMAIL_COLORS.brand};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">${kicker}</p>
<h1 style="margin:0 0 14px 0;font-family:${EMAIL_FONT};font-size:24px;font-weight:400;line-height:1.25;color:${EMAIL_COLORS.heading};letter-spacing:0;">${heading}</h1>
${subheadHtml}
${body}
${cta}
</td></tr>
<tr><td style="padding:24px 4px 0 4px;font-family:${EMAIL_FONT};font-size:12px;color:${EMAIL_COLORS.muted};" align="center">
<a href="{{unsubscribeUrl}}" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Manage notifications</a>
&nbsp;&middot;&nbsp;
<a href="{{appUrl}}" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Open TaskNebula</a>
&nbsp;&middot;&nbsp;
<a href="{{appUrl}}/help" style="color:${EMAIL_COLORS.muted};text-decoration:none;">Help</a>
</td></tr>
<tr><td style="padding:10px 4px 0 4px;font-family:${EMAIL_FONT};font-size:11px;color:${EMAIL_COLORS.faint};" align="center">
You're receiving this because you're a member of {{organizationName}}.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Building blocks callers compose into the `body` slot of renderShell().
// ---------------------------------------------------------------------------

/** Paragraph with body-text styling. */
export function paragraph(text: string, opts?: { muted?: boolean; spacingTop?: number }): string {
  const color = opts?.muted ? EMAIL_COLORS.muted : EMAIL_COLORS.body;
  const marginTop = opts?.spacingTop ?? 0;
  return `<p style="margin:${marginTop}px 0 0 0;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:${color};">${text}</p>`;
}

/** Two-column meta row (muted label on the left, value on the right). */
export function metaRow(label: string, value: string): string {
  return `<tr>
<td style="padding:8px 0;font-family:${EMAIL_FONT};font-size:13px;color:${EMAIL_COLORS.muted};width:130px;vertical-align:top;">${label}</td>
<td style="padding:8px 0;font-family:${EMAIL_FONT};font-size:13px;color:${EMAIL_COLORS.heading};vertical-align:top;">${value}</td>
</tr>`;
}

export function metaTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px 0;border-top:1px solid ${EMAIL_COLORS.border};border-bottom:1px solid ${EMAIL_COLORS.border};">${rows}</table>`;
}

/** Quote-style block for comments / mentions. */
export function quoteBlock(content: string, opts?: { accent?: string }): string {
  const accent = opts?.accent || EMAIL_COLORS.brand;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px 0;"><tr><td style="background:${EMAIL_COLORS.subtle};border-left:4px solid ${accent};border-radius:0;padding:14px 18px;font-family:${EMAIL_FONT};font-size:14px;line-height:1.65;color:${EMAIL_COLORS.body};">${content}</td></tr></table>`;
}

type InfoCardTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const INFO_CARD_PALETTE: Record<InfoCardTone, { bg: string; border: string; accent: string }> = {
  neutral: { bg: EMAIL_COLORS.subtle, border: EMAIL_COLORS.border, accent: EMAIL_COLORS.heading },
  success: { bg: '#defbe6', border: '#a7f0ba', accent: '#0e6027' },
  warning: { bg: '#fcf4d6', border: '#fddc69', accent: '#684e00' },
  danger: { bg: '#fff1f1', border: '#ffb3b8', accent: '#a2191f' },
  info: { bg: '#edf5ff', border: '#a6c8ff', accent: '#0f62fe' },
};

/** Bordered info card with title and body — for context summaries. */
export function infoCard(args: { title: string; body: string; tone?: InfoCardTone }): string {
  const p = INFO_CARD_PALETTE[args.tone ?? 'neutral'];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px 0;"><tr><td style="background:${p.bg};border-left:4px solid ${p.accent};border-top:1px solid ${p.border};border-right:1px solid ${p.border};border-bottom:1px solid ${p.border};border-radius:0;padding:16px 18px;">
<p style="margin:0 0 6px 0;font-family:${EMAIL_FONT};font-size:12px;font-weight:700;color:${p.accent};letter-spacing:0.06em;text-transform:uppercase;">${args.title}</p>
<div style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;color:${EMAIL_COLORS.body};">${args.body}</div>
</td></tr></table>`;
}

type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
const CHIP_PALETTE: Record<ChipTone, { bg: string; color: string }> = {
  neutral: { bg: '#e0e0e0', color: '#393939' },
  success: { bg: '#defbe6', color: '#0e6027' },
  warning: { bg: '#fcf4d6', color: '#684e00' },
  danger: { bg: '#fff1f1', color: '#a2191f' },
  info: { bg: '#edf5ff', color: '#0f62fe' },
  brand: { bg: '#edf5ff', color: '#0f62fe' },
};

/** Inline status / priority chip. */
export function chip(text: string, opts?: { tone?: ChipTone }): string {
  const p = CHIP_PALETTE[opts?.tone ?? 'neutral'];
  return `<span style="display:inline-block;background:${p.bg};color:${p.color};border-radius:0;font-size:11px;padding:3px 9px;font-weight:600;letter-spacing:0.02em;line-height:1.4;">${text}</span>`;
}

/** Actor row with avatar initial and name/email. */
export function actorRow(args: { name: string; email?: string; action?: string }): string {
  const initial = (args.name || args.email || '?').trim().charAt(0).toUpperCase();
  const subtitle = args.email || args.action || '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px 0;">
<tr>
<td width="40" style="vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:${EMAIL_COLORS.heading};color:#ffffff;border-radius:0;font-family:${EMAIL_FONT};font-size:14px;font-weight:600;line-height:1;">${initial}</td></tr></table>
</td>
<td style="padding-left:12px;vertical-align:middle;">
<div style="font-family:${EMAIL_FONT};font-size:14px;font-weight:600;color:${EMAIL_COLORS.heading};line-height:1.2;">${args.name}</div>
${subtitle ? `<div style="font-family:${EMAIL_FONT};font-size:12px;color:${EMAIL_COLORS.muted};line-height:1.4;margin-top:2px;">${subtitle}</div>` : ''}
</td>
</tr>
</table>`;
}

/** Stat grid row — up to 4 cells side by side with value + label. */
export function statGrid(
  stats: Array<{ value: string | number; label: string; tone?: 'neutral' | 'success' | 'brand' }>
): string {
  const cells = stats
    .map((s) => {
      const color =
        s.tone === 'success'
          ? EMAIL_COLORS.success
          : s.tone === 'brand'
            ? EMAIL_COLORS.brand
            : EMAIL_COLORS.heading;
      return `<td align="center" valign="top" style="padding:14px 8px;background:${EMAIL_COLORS.subtle};border:1px solid ${EMAIL_COLORS.border};border-radius:0;">
<div style="font-family:${EMAIL_FONT};font-size:22px;font-weight:400;color:${color};line-height:1.2;letter-spacing:0;">${s.value}</div>
<div style="font-family:${EMAIL_FONT};font-size:11px;color:${EMAIL_COLORS.muted};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-top:4px;">${s.label}</div>
</td>`;
    })
    .join('<td width="8" style="width:8px;">&nbsp;</td>');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px 0;"><tr>${cells}</tr></table>`;
}

/** Divider line with optional padding. */
export function divider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 6px 0;"><tr><td style="border-top:1px solid ${EMAIL_COLORS.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

/** Simple section heading inside the card. */
export function sectionHeading(text: string): string {
  return `<h2 style="margin:18px 0 8px 0;font-family:${EMAIL_FONT};font-size:14px;font-weight:700;color:${EMAIL_COLORS.heading};letter-spacing:-0.005em;">${text}</h2>`;
}

/** Ordered/unordered list built as table rows (more reliable across clients). */
export function bulletList(items: string[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td valign="top" width="14" style="padding:4px 8px 4px 0;font-family:${EMAIL_FONT};font-size:14px;color:${EMAIL_COLORS.brand};line-height:1.6;">&bull;</td><td style="padding:4px 0;font-family:${EMAIL_FONT};font-size:14px;color:${EMAIL_COLORS.body};line-height:1.6;">${item}</td></tr>`
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 4px 0;">${rows}</table>`;
}

/** Short plain-text footer appended to every text/* alternative. */
export function textFooter(): string {
  return (
    '\n\n---\n' +
    'Manage notifications: {{unsubscribeUrl}}\n' +
    "You're receiving this because you're a member of {{organizationName}}."
  );
}
