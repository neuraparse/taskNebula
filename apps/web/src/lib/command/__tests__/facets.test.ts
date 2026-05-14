import { activeFacetPicker, parseFacets, removeFacet } from '../facets';

describe('facets', () => {
  describe('parseFacets', () => {
    it('extracts a single chip and leaves the free text', () => {
      const { text, facets } = parseFacets('login bug status:in_progress');
      expect(facets).toEqual([{ key: 'status', value: 'in_progress' }]);
      expect(text).toBe('login bug');
    });

    it('extracts quoted multi-word values', () => {
      const { text, facets } = parseFacets('assignee:"alice doe" timer');
      expect(facets).toEqual([{ key: 'assignee', value: 'alice doe' }]);
      expect(text).toBe('timer');
    });

    it('ignores unknown facet keys', () => {
      const { text, facets } = parseFacets('foo:bar urgent');
      expect(facets).toEqual([]);
      expect(text).toBe('foo:bar urgent');
    });

    it('preserves order of multiple facets', () => {
      const { facets } = parseFacets(
        'project:web label:urgent assignee:me regression'
      );
      expect(facets.map((f) => f.key)).toEqual(['project', 'label', 'assignee']);
    });
  });

  describe('activeFacetPicker', () => {
    it('returns the facet when ending with key:', () => {
      expect(activeFacetPicker('hello status:')).toBe('status');
      expect(activeFacetPicker('assignee:')).toBe('assignee');
    });

    it('returns null when the facet has a value', () => {
      expect(activeFacetPicker('status:open')).toBeNull();
    });

    it('returns null for unknown keys', () => {
      expect(activeFacetPicker('something:')).toBeNull();
    });
  });

  describe('removeFacet', () => {
    it('removes a chip and tidies whitespace', () => {
      const updated = removeFacet('login status:in_progress bug', {
        key: 'status',
        value: 'in_progress',
      });
      expect(updated).toBe('login bug');
    });

    it('removes a quoted chip', () => {
      const updated = removeFacet('assignee:"alice doe" pending', {
        key: 'assignee',
        value: 'alice doe',
      });
      expect(updated).toBe('pending');
    });
  });
});
