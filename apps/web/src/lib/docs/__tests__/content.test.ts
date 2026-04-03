import {
  createDocumentAppHref,
  createDefaultDocumentContent,
  createInternalDocumentHref,
  createPublicDocumentHref,
  createIssueSpecDocumentContent,
  extractDocumentExcerpt,
  extractDocumentHeadings,
  extractDocumentText,
  extractInternalDocumentLinkIds,
  sanitizePublicDocumentContent,
  slugifyDocumentTitle,
} from '../content';

describe('docs content helpers', () => {
  it('slugifies document titles safely', () => {
    expect(slugifyDocumentTitle('  API Design / Review Notes  ')).toBe('api-design-review-notes');
    expect(slugifyDocumentTitle('@@@')).toBe('untitled');
  });

  it('creates a default document shell', () => {
    expect(createDefaultDocumentContent()).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Start writing your team knowledge here.' }],
        },
      ],
    });
  });

  it('builds the correct in-app path for org and project docs', () => {
    expect(createDocumentAppHref({ id: 'page_1', spaceId: 'space_org', projectId: null })).toBe(
      '/docs?pageId=page_1&spaceId=space_org'
    );
    expect(createDocumentAppHref({ id: 'page_2', spaceId: 'space_proj', projectId: 'proj_42' })).toBe(
      '/projects/proj_42/docs?pageId=page_2&spaceId=space_proj'
    );
  });

  it('extracts text, excerpt, headings, and internal links from rich content', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Launch Plan' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Ship the new docs module and link ' },
            {
              type: 'text',
              text: 'implementation notes',
              marks: [
                {
                  type: 'link',
                  attrs: { href: createInternalDocumentHref('page_alpha'), pageId: 'page_alpha' },
                },
              ],
            },
            { type: 'text', text: ' for follow-up.' },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Risks' }],
        },
      ],
    };

    expect(extractDocumentText(content)).toBe('Launch Plan Ship the new docs module and link implementation notes for follow-up. Risks');
    expect(extractDocumentExcerpt(content, 40)).toBe('Launch Plan Ship the new docs module and...');
    expect(extractInternalDocumentLinkIds(content)).toEqual(['page_alpha']);
    expect(extractDocumentHeadings(content)).toEqual([
      { id: 'heading-1', text: 'Launch Plan', level: 1 },
      { id: 'heading-2', text: 'Risks', level: 2 },
    ]);
  });

  it('builds a spec starter document for an issue', () => {
    const content = createIssueSpecDocumentContent({
      key: 'TN-42',
      title: 'Roll out docs search',
      description: 'Need searchable documentation linked to tasks.',
    });

    expect(extractDocumentText(content)).toContain('TN-42 Spec');
    expect(extractDocumentText(content)).toContain('Linked issue: TN-42');
    expect(extractDocumentText(content)).toContain('Need searchable documentation linked to tasks.');
  });

  it('sanitizes public content by stripping unsafe links and workspace-only uploads', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Public child page',
              marks: [
                {
                  type: 'link',
                  attrs: { href: createInternalDocumentHref('page_public'), pageId: 'page_public' },
                },
              ],
            },
            {
              type: 'text',
              text: ' private page',
              marks: [
                {
                  type: 'link',
                  attrs: { href: createInternalDocumentHref('page_private'), pageId: 'page_private' },
                },
              ],
            },
          ],
        },
        {
          type: 'image',
          attrs: {
            src: '/api/uploads/doc-image.png',
          },
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Unsafe link',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    };

    const sanitized = sanitizePublicDocumentContent(content, {
      allowAttachments: true,
      pageShareTokensById: new Map([['page_public', 'public-token']]),
      attachmentUrlByPath: new Map([['/uploads/doc-image.png', '/api/public/docs/public-token/assets/asset_1']]),
    });

    expect(JSON.stringify(sanitized)).toContain(createPublicDocumentHref('public-token'));
    expect(JSON.stringify(sanitized)).not.toContain('page_private');
    expect(JSON.stringify(sanitized)).toContain('/api/public/docs/public-token/assets/asset_1');
    expect(JSON.stringify(sanitized)).not.toContain('javascript:alert(1)');
  });
});
