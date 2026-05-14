/**
 * @jest-environment node
 *
 * CSV importer adapter tests.
 *
 * Covers:
 *   - the minimal RFC-4180 parser (quoted fields, escaped quotes, CRLF)
 *   - heuristic column-mapping suggestions
 *   - parseSource → NormalizedRecord shape
 *   - mapRecord → TaskNebulaIssue shape + priority normalization
 */

import {
  csvImporter,
  parseCsvText,
  suggestColumnMapping,
} from '../importers/csv';

describe('parseCsvText', () => {
  it('parses a simple header + row', () => {
    const out = parseCsvText('a,b,c\n1,2,3');
    expect(out.headers).toEqual(['a', 'b', 'c']);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ a: '1', b: '2', c: '3' });
  });

  it('handles quoted fields with commas inside', () => {
    const out = parseCsvText('title,desc\n"Hello, world","plain"');
    expect(out.rows[0].title).toBe('Hello, world');
    expect(out.rows[0].desc).toBe('plain');
  });

  it('handles escaped double-quotes', () => {
    const out = parseCsvText('title\n"She said ""hi"""');
    expect(out.rows[0].title).toBe('She said "hi"');
  });

  it('handles CRLF line endings', () => {
    const out = parseCsvText('a,b\r\n1,2\r\n3,4\r\n');
    expect(out.rows).toHaveLength(2);
    expect(out.rows[1]).toMatchObject({ a: '3', b: '4' });
  });

  it('returns empty result on blank input', () => {
    expect(parseCsvText('')).toEqual({ headers: [], rows: [] });
    expect(parseCsvText('   ')).toEqual({ headers: [], rows: [] });
  });

  it('drops a trailing blank row from a file ending in newline', () => {
    const out = parseCsvText('a\n1\n');
    expect(out.rows).toHaveLength(1);
  });
});

describe('suggestColumnMapping', () => {
  it('maps common header names case-insensitively', () => {
    const map = suggestColumnMapping([
      'Summary',
      'Description',
      'Status',
      'Priority',
      'Labels',
      'Assignee',
      'Parent',
      'Created',
      'Key',
    ]);
    expect(map).toMatchObject({
      title: 'Summary',
      description: 'Description',
      status: 'Status',
      priority: 'Priority',
      labels: 'Labels',
      assigneeEmail: 'Assignee',
      parentKey: 'Parent',
      createdAt: 'Created',
      key: 'Key',
    });
  });

  it('returns an empty mapping for unknown headers', () => {
    expect(suggestColumnMapping(['foo', 'bar'])).toEqual({});
  });
});

describe('csvImporter.parseSource', () => {
  it('returns NormalizedRecords with the expected shape', async () => {
    const csv = [
      'Title,Description,Status,Priority,Labels,Assignee,Parent,Created,Key',
      '"Fix bug","Crash on save","To Do","High","bug;urgent","alice@example.com","EPIC-1","2026-01-01","CSV-1"',
      '"Ship feature","",In Progress,low,backend,bob@example.com,,2026-02-01,CSV-2',
    ].join('\n');

    const records = await csvImporter.parseSource({ text: csv });
    expect(records).toHaveLength(2);

    const [first, second] = records;
    expect(first).toMatchObject({
      key: 'CSV-1',
      title: 'Fix bug',
      description: 'Crash on save',
      status: 'To Do',
      priority: 'High',
      assigneeEmail: 'alice@example.com',
      parentKey: 'EPIC-1',
      createdAt: '2026-01-01',
      comments: [],
    });
    expect(first.labels).toEqual(['bug', 'urgent']);
    expect(second.labels).toEqual(['backend']);
    expect(second.parentKey).toBeNull();
    expect(second.description).toBeNull();
  });

  it('synthesizes a key when no key column is mapped', async () => {
    const csv = 'Title\nA\nB';
    const records = await csvImporter.parseSource({ text: csv });
    expect(records[0].key).toBe('csv-row-1');
    expect(records[1].key).toBe('csv-row-2');
  });

  it('honors an explicit column mapping over the heuristic', async () => {
    // Header is 'Name' (not auto-detected as title) — only explicit mapping rescues it.
    const csv = 'Name,Owner\nFoo,boss@example.com';
    const records = await csvImporter.parseSource({
      text: csv,
      columns: { title: 'Name', assigneeEmail: 'Owner' },
    });
    expect(records[0].title).toBe('Foo');
    expect(records[0].assigneeEmail).toBe('boss@example.com');
  });
});

describe('csvImporter.mapRecord', () => {
  it('produces a TaskNebulaIssue with normalized priority', () => {
    const rec = {
      key: 'CSV-1',
      title: 'Something',
      description: 'desc',
      status: 'In Progress',
      priority: 'High',
      labels: ['a'],
      assigneeEmail: 'a@b.com',
      parentKey: 'EPIC-1',
      createdAt: '2026-01-01',
      comments: [],
    };
    const issue = csvImporter.mapRecord(rec, {});
    expect(issue).toMatchObject({
      sourceKey: 'CSV-1',
      title: 'Something',
      description: 'desc',
      type: 'task',
      status: 'In Progress',
      priority: 'high',
      labels: ['a'],
      assigneeEmail: 'a@b.com',
      parentSourceKey: 'EPIC-1',
    });
    expect(issue.createdAt).toBeInstanceOf(Date);
  });

  it('falls back to "(untitled)" when title is empty', () => {
    const rec = {
      key: 'x',
      title: '',
      description: null,
      status: null,
      priority: null,
      labels: [],
      assigneeEmail: null,
      parentKey: null,
      createdAt: null,
      comments: [],
    };
    const issue = csvImporter.mapRecord(rec, {});
    expect(issue.title).toBe('(untitled)');
    expect(issue.priority).toBe('medium');
    expect(issue.createdAt).toBeNull();
  });

  it('respects mapping.defaultType', () => {
    const rec = {
      key: 'x',
      title: 't',
      description: null,
      status: null,
      priority: null,
      labels: [],
      assigneeEmail: null,
      parentKey: null,
      createdAt: null,
      comments: [],
    };
    const issue = csvImporter.mapRecord(rec, { defaultType: 'bug' });
    expect(issue.type).toBe('bug');
  });
});

describe('normalizePriority via mapRecord', () => {
  const baseRec = {
    key: 'x',
    title: 't',
    description: null,
    status: null,
    labels: [],
    assigneeEmail: null,
    parentKey: null,
    createdAt: null,
    comments: [],
  } as const;

  it.each([
    ['critical', 'critical'],
    ['urgent', 'critical'],
    ['P0', 'critical'],
    ['1', 'critical'],
    ['high', 'high'],
    ['P2', 'high'],
    ['medium', 'medium'],
    ['normal', 'medium'],
    ['low', 'low'],
    ['none', 'none'],
    ['no priority', 'none'],
    ['garbage', 'medium'],
    [null, 'medium'],
  ])('maps %s → %s', (input, expected) => {
    const issue = csvImporter.mapRecord(
      { ...baseRec, priority: input as string | null },
      {}
    );
    expect(issue.priority).toBe(expected);
  });
});
