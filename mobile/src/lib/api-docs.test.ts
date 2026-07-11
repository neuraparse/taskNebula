import {
  filterApiDocOperations,
  getApiDocsSpec,
  listApiDocOperations,
  listApiDocTags,
} from './api-docs';

describe('api docs helpers', () => {
  it('loads the bundled OpenAPI document', () => {
    const spec = getApiDocsSpec();

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('TaskNebula API');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it('normalizes operations from the OpenAPI paths', () => {
    const operations = listApiDocOperations();

    expect(operations.length).toBeGreaterThan(0);
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'GET /api/issues',
          method: 'get',
          path: '/api/issues',
          requiresAuth: true,
        }),
        expect.objectContaining({
          id: 'POST /api/issues',
          method: 'post',
          path: '/api/issues',
          hasRequestBody: true,
        }),
      ]),
    );
  });

  it('returns sorted unique tags', () => {
    const tags = listApiDocTags(listApiDocOperations());

    expect(tags).toEqual([...tags].sort((left, right) => left.localeCompare(right)));
    expect(tags).toContain('Issues');
    expect(tags).toContain('Projects');
  });

  it('filters by search text and tag', () => {
    const operations = listApiDocOperations();

    expect(filterApiDocOperations(operations, 'JQL', null)).toEqual([
      expect.objectContaining({ id: 'POST /api/search' }),
    ]);
    expect(filterApiDocOperations(operations, '', 'Health')).toEqual([
      expect.objectContaining({ id: 'GET /api/health', requiresAuth: false }),
    ]);
  });
});
