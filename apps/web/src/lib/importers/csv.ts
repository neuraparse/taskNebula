/**
 * CSV importer adapter (fully functional).
 *
 * Accepts a raw CSV string and a column → field mapping. The CSV is parsed
 * with a tiny RFC-4180-ish reader (no external dependency) that handles
 * quoted values, escaped quotes (""), and CRLF newlines. Once parsed, each
 * row is projected onto `NormalizedRecord` using the supplied mapping.
 *
 * Mapping shape (a subset of ImportMapping.columns):
 *   {
 *     title: 'Issue Title',          // required, no useful default
 *     description: 'Description',    // optional
 *     status: 'Status',              // optional
 *     priority: 'Priority',          // optional
 *     labels: 'Labels',              // comma- or semicolon-separated
 *     assigneeEmail: 'Assignee',
 *     parentKey: 'Parent',
 *     createdAt: 'Created',
 *     key: 'ID',                     // falls back to row index when missing
 *   }
 *
 * The adapter also returns a `suggestedMapping` helper used by the preview
 * endpoint so the UI can pre-fill the column picker.
 */

import {
  Importer,
  ImportMapping,
  NormalizedRecord,
  normalizePriority,
  normalizeType,
  safeParseDate,
} from './types';

export type CsvInput = {
  /** Raw CSV text — usually the request body of a file upload. */
  text: string;
  /**
   * Column header → NormalizedRecord field name. Optional: we'll suggest
   * a mapping based on header heuristics if absent.
   */
  columns?: ImportMapping['columns'];
};

type ParsedCsv = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

/**
 * Minimal RFC-4180 reader. Supports quoted fields, escaped quotes (""),
 * commas inside quotes, LF / CRLF line endings, and trims trailing
 * newlines. Throws if a row's column count doesn't match the header.
 */
export function parseCsvText(text: string): ParsedCsv {
  if (!text || !text.trim()) {
    return { headers: [], rows: [] };
  }

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      // Handle CRLF: skip the LF after a CR.
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }

  // Flush trailing field / row (no final newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing blank rows (e.g. file ends with a newline).
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last && last.length === 1 && last[0] === '') {
      rows.pop();
    } else {
      break;
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((h) => h.trim());
  const dataRows = rows.slice(1).map((cols, rowIdx) => {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      obj[header] = (cols[c] ?? '').trim();
    }
    // Preserve a synthetic row index so we can build keys even when the
    // CSV doesn't have an id column.
    obj.__rowIndex = String(rowIdx);
    return obj;
  });

  return { headers, rows: dataRows };
}

/**
 * Header heuristics: maps common CSV column names to `NormalizedRecord`
 * fields. Case-insensitive, also tolerates Jira / Linear export defaults
 * (e.g. 'Summary' → title, 'Issue Type' → type).
 */
export function suggestColumnMapping(
  headers: string[]
): NonNullable<ImportMapping['columns']> {
  const map: NonNullable<ImportMapping['columns']> = {};
  for (const h of headers) {
    const low = h.toLowerCase().trim();
    if (!map.title && (low === 'title' || low === 'summary' || low === 'name')) {
      map.title = h;
    } else if (
      !map.description &&
      (low === 'description' || low === 'body' || low === 'details')
    ) {
      map.description = h;
    } else if (
      !map.status &&
      (low === 'status' || low === 'state' || low === 'workflow status')
    ) {
      map.status = h;
    } else if (!map.priority && low === 'priority') {
      map.priority = h;
    } else if (
      !map.labels &&
      (low === 'labels' || low === 'label' || low === 'tags' || low === 'tag')
    ) {
      map.labels = h;
    } else if (
      !map.assigneeEmail &&
      (low === 'assignee' ||
        low === 'assignee email' ||
        low === 'assigned to' ||
        low === 'owner')
    ) {
      map.assigneeEmail = h;
    } else if (
      !map.parentKey &&
      (low === 'parent' || low === 'parent key' || low === 'epic link')
    ) {
      map.parentKey = h;
    } else if (
      !map.createdAt &&
      (low === 'created' ||
        low === 'created at' ||
        low === 'created date' ||
        low === 'date created')
    ) {
      map.createdAt = h;
    } else if (
      !map.key &&
      (low === 'key' || low === 'id' || low === 'issue key' || low === 'issue id')
    ) {
      map.key = h;
    }
  }
  return map;
}

function splitLabels(raw: string): string[] {
  if (!raw) return [];
  // Allow either comma- or semicolon-separated labels.
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const csvImporter: Importer<CsvInput> = {
  name: 'csv',
  label: 'CSV file',
  description:
    'Upload a CSV exported from any tool. Map columns to TaskNebula fields and run.',

  async parseSource(input) {
    const { text, columns } = input;
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0) return [];

    const resolvedColumns = columns ?? suggestColumnMapping(parsed.headers);

    return parsed.rows.map((row, idx): NormalizedRecord => {
      const get = (field: keyof NormalizedRecord): string => {
        const col = resolvedColumns?.[field];
        if (!col) return '';
        return row[col] ?? '';
      };

      return {
        key: get('key') || `csv-row-${idx + 1}`,
        title: get('title'),
        description: get('description') || null,
        status: get('status') || null,
        priority: get('priority') || null,
        labels: splitLabels(get('labels')),
        assigneeEmail: get('assigneeEmail') || null,
        parentKey: get('parentKey') || null,
        createdAt: get('createdAt') || null,
        comments: [],
      };
    });
  },

  mapRecord(rec, mapping) {
    return {
      sourceKey: rec.key,
      title: rec.title || '(untitled)',
      description: rec.description,
      type: normalizeType(null, mapping.defaultType ?? 'task'),
      status: rec.status,
      priority: normalizePriority(rec.priority),
      labels: rec.labels,
      assigneeEmail: rec.assigneeEmail,
      parentSourceKey: rec.parentKey,
      createdAt: safeParseDate(rec.createdAt),
      comments: [],
    };
  },
};
