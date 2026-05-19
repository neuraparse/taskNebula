/**
 * Hide auth tokens from audit-log sink responses so pages never accidentally
 * leak them into the browser bundle/state.
 */
export function redactSinkConfig(
  _type: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...config };
  const SECRET_KEYS = ['token', 'apiKey', 'secret', 'password'];
  for (const key of SECRET_KEYS) {
    if (typeof out[key] === 'string' && (out[key] as string).length > 0) {
      out[key] = '••••••••';
    }
  }
  return out;
}
