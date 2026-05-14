/**
 * SCIM 2.0 PATCH operation applier.
 *
 * Implements enough of RFC 7644 §3.5.2 to interoperate with the two
 * implementations that diverge the most in the wild:
 *
 *  1. Okta — sends simple `path` values like `"userName"`, `"active"`,
 *     `"name.givenName"`, and the `members` array for groups. Op values are
 *     PascalCase (`"Add"`, `"Replace"`, `"Remove"`).
 *
 *  2. Microsoft Entra ID — sends lowercase op names and uses two non-standard
 *     path shapes:
 *       a) Implicit path:  `{op:'Replace', value:{ userName:'x', active:false }}`
 *          (no `path` — the entire `value` object is merged into the resource)
 *       b) Filtered path:  `emails[type eq "work"].value`
 *          We resolve the filter against the current resource state.
 *
 * The applier returns a JSON-mergeable patch object (new field values for
 * the user / group). Callers then turn that into a Drizzle update.
 */
import type { PatchOperation } from './types';

type Json = Record<string, unknown>;

export type FlattenedUserPatch = {
  userName?: string;
  givenName?: string | null;
  familyName?: string | null;
  displayName?: string | null;
  active?: boolean;
  primaryEmail?: string;
};

export type FlattenedGroupPatch = {
  displayName?: string;
  addMembers?: string[];
  removeMembers?: string[];
  replaceMembers?: string[];
};

function normalizeOp(op: string): 'add' | 'remove' | 'replace' {
  const lower = (op || '').toLowerCase();
  if (lower === 'add' || lower === 'remove' || lower === 'replace') return lower;
  throw new Error(`Unsupported SCIM op: ${op}`);
}

/**
 * Parse a SCIM path like `emails[type eq "work"].value` into segments.
 * Returns null for inputs we don't understand (caller decides to error).
 */
type PathSegment = { name: string; filter?: { key: string; value: string } };

function parsePath(path: string): PathSegment[] | null {
  // simple: foo.bar.baz
  // filtered: emails[type eq "work"].value
  const result: PathSegment[] = [];
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)(\[(.+?)\])?/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(path)) !== null) {
    consumed = m.index + m[0].length;
    const name = m[1];
    if (!name) continue;
    const seg: PathSegment = { name };
    if (m[3]) {
      // Entra-style filter — only `<key> eq "<value>"`.
      const f = /^([a-zA-Z_][a-zA-Z0-9_]*)\s+eq\s+["'](.+?)["']$/.exec(
        m[3].trim()
      );
      if (!f || !f[1] || f[2] === undefined) return null;
      seg.filter = { key: f[1], value: f[2] };
    }
    result.push(seg);
    // skip a separating dot if present
    if (path[consumed] === '.') consumed += 1;
  }
  if (!result.length) return null;
  return result;
}

/** Apply a list of PATCH operations to a SCIM User. Returns a flat patch.
 *  `_current` is reserved for future filter resolution against current state
 *  (e.g. `emails[type eq "work"].value` could pick which entry to mutate).
 */
export function applyUserPatch(
  operations: PatchOperation[],
  _current: {
    userName: string;
    name?: { givenName?: string | null; familyName?: string | null };
    displayName?: string | null;
    active: boolean;
    emails?: { value: string; type?: string; primary?: boolean }[];
  }
): FlattenedUserPatch {
  const out: FlattenedUserPatch = {};

  for (const raw of operations) {
    const op = normalizeOp(raw.op);

    // Case A: Entra implicit-path replace — value is an object literal.
    if (!raw.path) {
      if (op === 'remove') {
        throw new Error('SCIM remove requires a path');
      }
      const v = (raw.value ?? {}) as Json;
      if (typeof v.userName === 'string') out.userName = v.userName;
      if (typeof v.displayName === 'string' || v.displayName === null) {
        out.displayName = (v.displayName as string | null) ?? null;
      }
      if (typeof v.active === 'boolean') out.active = v.active;
      if (v.name && typeof v.name === 'object') {
        const n = v.name as Json;
        if (typeof n.givenName === 'string' || n.givenName === null) {
          out.givenName = (n.givenName as string | null) ?? null;
        }
        if (typeof n.familyName === 'string' || n.familyName === null) {
          out.familyName = (n.familyName as string | null) ?? null;
        }
      }
      if (Array.isArray(v.emails)) {
        const primary = (v.emails as { value: string; primary?: boolean }[])
          .find((e) => e.primary)?.value ?? (v.emails as { value: string }[])[0]?.value;
        if (primary) out.primaryEmail = primary;
      }
      continue;
    }

    // Case B: explicit path (Okta + Entra).
    const path = raw.path;
    if (path.toLowerCase() === 'username') {
      out.userName = String(raw.value ?? '');
      continue;
    }
    if (path.toLowerCase() === 'displayname') {
      out.displayName = raw.value == null ? null : String(raw.value);
      continue;
    }
    if (path.toLowerCase() === 'active') {
      out.active = raw.value === true || raw.value === 'true';
      continue;
    }
    if (path === 'name.givenName' || path === 'name.formatted') {
      out.givenName = raw.value == null ? null : String(raw.value);
      continue;
    }
    if (path === 'name.familyName') {
      out.familyName = raw.value == null ? null : String(raw.value);
      continue;
    }

    const segments = parsePath(path);
    if (!segments) throw new Error(`Unparseable SCIM path: ${path}`);

    if (segments[0]?.name === 'emails') {
      // emails[type eq "work"].value  → set primary email if it matches
      if (op === 'add' || op === 'replace') {
        if (segments.length >= 2 && segments[1]?.name === 'value') {
          out.primaryEmail = String(raw.value ?? '');
        } else if (segments.length === 1) {
          const v = raw.value as
            | { value: string; primary?: boolean }[]
            | { value: string; primary?: boolean }
            | undefined;
          if (Array.isArray(v)) {
            out.primaryEmail = v.find((e) => e.primary)?.value ?? v[0]?.value;
          } else if (v && typeof v === 'object') {
            out.primaryEmail = v.value;
          }
        }
      }
      continue;
    }

    // Unrecognised paths get silently ignored per RFC 7644 §3.5.2 (servers
    // SHOULD ignore unknown attributes) — but log them for diagnostics.
    // eslint-disable-next-line no-console
    console.warn(`[scim] ignoring unknown User path: ${path}`);
  }

  return out;
}

/** Apply a list of PATCH operations to a SCIM Group. */
export function applyGroupPatch(
  operations: PatchOperation[]
): FlattenedGroupPatch {
  const out: FlattenedGroupPatch = {};

  for (const raw of operations) {
    const op = normalizeOp(raw.op);
    const path = raw.path ?? '';

    if (!path && op === 'replace') {
      const v = (raw.value ?? {}) as Json;
      if (typeof v.displayName === 'string') out.displayName = v.displayName;
      if (Array.isArray(v.members)) {
        out.replaceMembers = (v.members as { value: string }[]).map(
          (m) => m.value
        );
      }
      continue;
    }

    if (path.toLowerCase() === 'displayname') {
      out.displayName = String(raw.value ?? '');
      continue;
    }

    // Entra-style filtered remove: `members[value eq "<id>"]`
    const segments = parsePath(path);
    if (!segments) continue;
    const firstSeg = segments[0];
    if (!firstSeg) continue;
    if (firstSeg.name.toLowerCase() === 'members') {
      if (op === 'remove') {
        const list = out.removeMembers ?? [];
        // Filter form: members[value eq "<id>"]
        if (firstSeg.filter?.key === 'value' && firstSeg.filter.value) {
          list.push(firstSeg.filter.value);
        } else if (Array.isArray(raw.value)) {
          for (const m of raw.value as { value: string }[]) list.push(m.value);
        }
        out.removeMembers = list;
      } else if (op === 'add') {
        const list = out.addMembers ?? [];
        if (Array.isArray(raw.value)) {
          for (const m of raw.value as { value: string }[]) list.push(m.value);
        } else if (raw.value && typeof raw.value === 'object') {
          list.push((raw.value as { value: string }).value);
        }
        out.addMembers = list;
      } else if (op === 'replace') {
        const list: string[] = [];
        if (Array.isArray(raw.value)) {
          for (const m of raw.value as { value: string }[]) list.push(m.value);
        }
        out.replaceMembers = list;
      }
    }
  }

  return out;
}
