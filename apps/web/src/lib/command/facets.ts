/**
 * Facet parsing for the Cmd+K omnibar (FEAT-25).
 *
 * Facets are inline filter chips typed as `key:value` (or `key:"multi
 * word"`). They strip out of the free-text query and surface as
 * removable badges next to the input.
 */

export type FacetKey = 'status' | 'assignee' | 'project' | 'label' | 'type' | 'priority';

export const FACET_KEYS: ReadonlyArray<FacetKey> = [
  'status',
  'assignee',
  'project',
  'label',
  'type',
  'priority',
];

export interface Facet {
  key: FacetKey;
  value: string;
}

export interface ParsedQuery {
  /** Free-text portion with all facet tokens removed. */
  text: string;
  /** Facets extracted from the input, in order of appearance. */
  facets: Facet[];
}

/**
 * Matches `key:value` and `key:"quoted value"` segments. We intentionally
 * keep the regex simple — quotes are only recognized at the boundaries
 * of the value.
 */
const FACET_RE = /(\w+):("([^"]*)"|([^\s]+))/g;

export function parseFacets(input: string): ParsedQuery {
  const facets: Facet[] = [];
  let lastIndex = 0;
  let textOut = '';

  for (const match of input.matchAll(FACET_RE)) {
    const rawKey = match[1];
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    const value = match[3] ?? match[4] ?? '';
    if (!FACET_KEYS.includes(key as FacetKey)) continue;
    if (!value) continue;

    textOut += input.slice(lastIndex, match.index ?? 0);
    facets.push({ key: key as FacetKey, value });
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  textOut += input.slice(lastIndex);
  return { text: textOut.replace(/\s+/g, ' ').trim(), facets };
}

/**
 * Returns the active facet key if the input is currently in the middle
 * of typing one (i.e. ends with `key:` and no value yet). Used to pop
 * an inline picker.
 */
export function activeFacetPicker(input: string): FacetKey | null {
  const match = input.match(/(\w+):$/);
  if (!match || !match[1]) return null;
  const key = match[1].toLowerCase();
  return FACET_KEYS.includes(key as FacetKey) ? (key as FacetKey) : null;
}

/**
 * Removes the chip from the input string, preserving free text and other
 * chips. Useful when the user clicks the × on a chip.
 */
export function removeFacet(input: string, facet: Facet): string {
  const escaped = facet.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${facet.key}:("${escaped}"|${escaped})\\s?`);
  return input.replace(re, '').replace(/\s+/g, ' ').trim();
}
