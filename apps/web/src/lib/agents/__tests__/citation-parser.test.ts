/**
 * @jest-environment node
 */

import {
  parseCitations,
  extractCitationMarkers,
  findUnresolvedCitations,
  type CitationSource,
} from '../citation-parser';

const sources: CitationSource[] = [
  {
    type: 'issue',
    id: 'iss_1',
    key: 'TASK-42',
    title: 'Login crash on Safari',
    snippet: 'Reported by QA on 2026-05-10.',
    url: '/issues/TASK-42',
  },
  {
    type: 'issue',
    id: 'iss_2',
    key: 'TASK-7',
    title: 'Add dark mode',
    snippet: 'Roadmap Q2 item.',
  },
  {
    type: 'doc',
    id: 'doc_99',
    key: 'doc_99',
    title: 'Release process',
    snippet: 'Cuts a tag, builds, deploys.',
  },
];

describe('citation-parser', () => {
  describe('parseCitations', () => {
    it('returns empty for empty answer', () => {
      expect(parseCitations('', sources)).toEqual([]);
    });

    it('returns empty when there are no sources', () => {
      expect(parseCitations('Something [TN-TASK-42].', [])).toEqual([]);
    });

    it('extracts a single issue citation by key', () => {
      const out = parseCitations('Login is broken [TN-TASK-42].', sources);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        type: 'issue',
        id: 'iss_1',
        key: 'TASK-42',
        title: 'Login crash on Safari',
        occurrence: 1,
      });
    });

    it('extracts a single document citation', () => {
      const out = parseCitations('See the release process [DOC-doc_99].', sources);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        type: 'doc',
        id: 'doc_99',
        title: 'Release process',
      });
    });

    it('handles multiple citations and deduplicates by (type,key)', () => {
      const answer = 'A [TN-TASK-42] then B [DOC-doc_99] and again [TN-TASK-42]. Also [TN-TASK-7].';
      const out = parseCitations(answer, sources);
      expect(out).toHaveLength(3);
      expect(out.map((c) => c.key)).toEqual(['TASK-42', 'doc_99', 'TASK-7']);
      expect(out.map((c) => c.occurrence)).toEqual([1, 2, 3]);
    });

    it('drops citations that do not resolve to a known source', () => {
      const answer = 'Ghost [TN-FAKE-1] but real [DOC-doc_99].';
      const out = parseCitations(answer, sources);
      expect(out).toHaveLength(1);
      expect(out[0]!.id).toBe('doc_99');
    });

    it('ignores malformed brackets', () => {
      const answer = '[TN-] [TN] (TN-TASK-42) {DOC-doc_99} [TN-TASK-42]';
      const out = parseCitations(answer, sources);
      expect(out).toHaveLength(1);
      expect(out[0]!.key).toBe('TASK-42');
    });

    it('matches doc by id when key is absent on the source record', () => {
      const out = parseCitations('Read [DOC-doc_99]', [
        { type: 'doc', id: 'doc_99', title: 'X', snippet: 'Y' },
      ]);
      expect(out).toHaveLength(1);
      expect(out[0]!.key).toBe('doc_99');
    });

    it('preserves order of first appearance even when referenced again later', () => {
      const answer = '[DOC-doc_99] then [TN-TASK-7] then [DOC-doc_99] then [TN-TASK-42]';
      const out = parseCitations(answer, sources);
      expect(out.map((c) => c.key)).toEqual(['doc_99', 'TASK-7', 'TASK-42']);
    });
  });

  describe('extractCitationMarkers', () => {
    it('returns deduped token list in order', () => {
      const out = extractCitationMarkers('[TN-A] [DOC-X] [TN-A] [TN-B]');
      expect(out).toEqual(['[TN-A]', '[DOC-X]', '[TN-B]']);
    });
  });

  describe('findUnresolvedCitations', () => {
    it('flags only markers that did not match any source', () => {
      const answer = '[TN-TASK-42] real, [TN-FAKE-1] hallucinated, [DOC-doc_99] real.';
      const out = findUnresolvedCitations(answer, sources);
      expect(out).toEqual(['[TN-FAKE-1]']);
    });

    it('returns empty when every marker resolves', () => {
      const answer = '[TN-TASK-42] [DOC-doc_99]';
      expect(findUnresolvedCitations(answer, sources)).toEqual([]);
    });
  });
});
