/**
 * Citation parser for the Ask TaskNebula RAG endpoint.
 *
 * The LLM is prompted to emit inline citation markers like `[TN-123]` for
 * issues and `[DOC-456]` for document pages on every load-bearing claim.
 * This module extracts those markers, deduplicates them, and joins them to
 * the retrieved-context corpus so the UI can render preview cards.
 *
 * Marker grammar:
 *   - `[TN-<key>]`      issue, where `<key>` is the issue's human key
 *                       (letters, digits, hyphens, underscores).
 *   - `[DOC-<id>]`      document page, where `<id>` is the page id.
 *
 * Citations that don't resolve back to a known source are dropped silently.
 * Order in the response is preserved (first appearance wins) so UI cards
 * mirror the reading order of the answer.
 */

export type CitationType = 'issue' | 'doc';

export interface CitationSource {
  type: CitationType;
  /** Stable id used for `[DOC-<id>]`. */
  id: string;
  /** Human-friendly key used for `[TN-<key>]`. Defaults to `id` for docs. */
  key?: string;
  title: string;
  snippet: string;
  url?: string;
}

export interface Citation {
  type: CitationType;
  id: string;
  key: string;
  title: string;
  snippet: string;
  url?: string;
  /** 1-based index of the first time this marker appeared in the text. */
  occurrence: number;
}

const MARKER_REGEX = /\[(TN|DOC)-([A-Za-z0-9_-]+)\]/g;

/**
 * Walk `answer` and pull out every `[TN-...]` / `[DOC-...]` marker. The
 * returned list is deduplicated by `(type, key)`, ordered by first
 * appearance, and joined to entries from `sources` (markers that don't
 * resolve are dropped).
 */
export function parseCitations(answer: string, sources: CitationSource[]): Citation[] {
  if (!answer || sources.length === 0) return [];

  // Build lookup tables. For issues we key by the human key (case-sensitive
  // to match how keys are minted, e.g. TASK-42 vs task-42). For docs we
  // accept both the page id and an optional explicit key.
  const issueByKey = new Map<string, CitationSource>();
  const docById = new Map<string, CitationSource>();

  for (const source of sources) {
    if (source.type === 'issue') {
      const key = source.key ?? source.id;
      if (!issueByKey.has(key)) issueByKey.set(key, source);
    } else {
      if (!docById.has(source.id)) docById.set(source.id, source);
      if (source.key && !docById.has(source.key)) docById.set(source.key, source);
    }
  }

  const seen = new Map<string, Citation>();
  let occurrence = 0;

  // `matchAll` keeps insertion order, which is what we want for the UI.
  for (const match of answer.matchAll(MARKER_REGEX)) {
    const prefix = match[1] as 'TN' | 'DOC';
    const rawKey = match[2]!;
    const lookupKey = `${prefix}:${rawKey}`;
    if (seen.has(lookupKey)) continue;

    let source: CitationSource | undefined;
    if (prefix === 'TN') {
      source = issueByKey.get(rawKey);
    } else {
      source = docById.get(rawKey);
    }
    if (!source) continue;

    occurrence += 1;
    seen.set(lookupKey, {
      type: source.type,
      id: source.id,
      key: source.key ?? source.id,
      title: source.title,
      snippet: source.snippet,
      url: source.url,
      occurrence,
    });
  }

  return Array.from(seen.values());
}

/**
 * Return the set of distinct marker tokens present in `answer`, in order
 * of first appearance. Useful for debug logs and tests.
 */
export function extractCitationMarkers(answer: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of answer.matchAll(MARKER_REGEX)) {
    const token = `[${match[1]}-${match[2]}]`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Best-effort check that every `[Source: ...]` claim in the answer was
 * grounded in a known citation. Returns the list of unresolved markers
 * so the API can surface "hallucinated source" warnings instead of
 * silently dropping them.
 */
export function findUnresolvedCitations(answer: string, sources: CitationSource[]): string[] {
  const resolved = new Set(
    parseCitations(answer, sources).map((c) => `[${c.type === 'issue' ? 'TN' : 'DOC'}-${c.key}]`)
  );
  const unresolved: string[] = [];
  const seen = new Set<string>();
  for (const match of answer.matchAll(MARKER_REGEX)) {
    const token = `[${match[1]}-${match[2]}]`;
    if (seen.has(token) || resolved.has(token)) continue;
    seen.add(token);
    unresolved.push(token);
  }
  return unresolved;
}
