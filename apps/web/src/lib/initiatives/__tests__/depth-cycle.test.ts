/**
 * @jest-environment node
 */
import {
  buildInitiativeIndex,
  wouldCreateInitiativeCycle,
  type InitiativeNode,
} from '@/lib/initiatives/depth';

describe('wouldCreateInitiativeCycle', () => {
  it('returns true when a node is re-parented onto itself', () => {
    const index = buildInitiativeIndex([{ id: 'A', parentInitiativeId: null }]);
    expect(wouldCreateInitiativeCycle('A', 'A', index)).toBe(true);
  });

  it('returns true when the new parent is an indirect descendant of the child', () => {
    // A → B → C ; reparenting B under C would create C → B → C.
    const nodes: InitiativeNode[] = [
      { id: 'A', parentInitiativeId: null },
      { id: 'B', parentInitiativeId: 'A' },
      { id: 'C', parentInitiativeId: 'B' },
    ];
    const index = buildInitiativeIndex(nodes);
    expect(wouldCreateInitiativeCycle('B', 'C', index)).toBe(true);
  });

  it('returns false for sibling re-parenting across distinct branches', () => {
    // A → B ; A → C. Moving B under C is fine — C is not a descendant of B.
    const nodes: InitiativeNode[] = [
      { id: 'A', parentInitiativeId: null },
      { id: 'B', parentInitiativeId: 'A' },
      { id: 'C', parentInitiativeId: 'A' },
    ];
    const index = buildInitiativeIndex(nodes);
    expect(wouldCreateInitiativeCycle('B', 'C', index)).toBe(false);
  });

  it('returns false when the new parent is null', () => {
    const index = buildInitiativeIndex([{ id: 'A', parentInitiativeId: null }]);
    expect(wouldCreateInitiativeCycle('A', null, index)).toBe(false);
  });

  it('returns false when the new parent is undefined', () => {
    const index = buildInitiativeIndex([{ id: 'A', parentInitiativeId: null }]);
    expect(wouldCreateInitiativeCycle('A', undefined, index)).toBe(false);
  });

  it('returns false when the new parent id is not present in the index', () => {
    // depth validation handles unknown-parent rejection separately; cycle
    // detection cannot prove anything without ancestry data.
    const index = buildInitiativeIndex([{ id: 'A', parentInitiativeId: null }]);
    expect(wouldCreateInitiativeCycle('A', 'ghost', index)).toBe(false);
  });

  it('detects cycles across deep descendant chains', () => {
    // A → B → C → D → E ; reparent B under E ⇒ cycle E → D → C → B → E.
    const nodes: InitiativeNode[] = [
      { id: 'A', parentInitiativeId: null },
      { id: 'B', parentInitiativeId: 'A' },
      { id: 'C', parentInitiativeId: 'B' },
      { id: 'D', parentInitiativeId: 'C' },
      { id: 'E', parentInitiativeId: 'D' },
    ];
    const index = buildInitiativeIndex(nodes);
    expect(wouldCreateInitiativeCycle('B', 'E', index)).toBe(true);
  });

  it('returns false when a pre-existing corruption cycle exists between unrelated nodes', () => {
    // Index already contains a cycle X → Y → X. Z is unrelated. Re-parenting
    // Z under X must not falsely flag — cycle detection should bail when it
    // re-visits a node without finding `childId`. Depth validation reports
    // the corruption separately.
    const nodes: InitiativeNode[] = [
      { id: 'X', parentInitiativeId: 'Y' },
      { id: 'Y', parentInitiativeId: 'X' },
      { id: 'Z', parentInitiativeId: null },
    ];
    const index = buildInitiativeIndex(nodes);
    expect(wouldCreateInitiativeCycle('Z', 'X', index)).toBe(false);
  });
});
