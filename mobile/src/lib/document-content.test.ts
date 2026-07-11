import {
  documentContentToPlainText,
  documentTextToContentJson,
  normalizeDocumentText,
  resolveDocumentLinkHref,
} from './document-content';

describe('document content helpers', () => {
  it('converts mobile text into structured document blocks', () => {
    expect(
      documentTextToContentJson(
        [
          '# Launch plan',
          '',
          'Coordinate release notes',
          '- [x] Prepare checklist',
          '- [ ] Watch metrics',
          '1. Deploy API',
          '2. Deploy mobile',
          '> Keep rollback ready',
          '```',
          'pnpm test',
          '```',
        ].join('\n'),
      ),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Launch plan' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Coordinate release notes' }],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Prepare checklist' }] },
              ],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Watch metrics' }] }],
            },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deploy API' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deploy mobile' }] }],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Keep rollback ready' }] },
          ],
        },
        {
          type: 'codeBlock',
          content: [{ type: 'text', text: 'pnpm test' }],
        },
      ],
    });
  });

  it('extracts editable plain text from rich document JSON', () => {
    const contentJson = documentTextToContentJson('# Heading\n\n- item\n- [x] done');

    expect(documentContentToPlainText(contentJson)).toBe('# Heading\n\n- item\n\n- [x] done');
    expect(normalizeDocumentText(' Line one\r\n\r\n')).toBe('Line one');
  });

  it('resolves private document links against the active self-hosted server', () => {
    expect(resolveDocumentLinkHref('/api/uploads/spec.pdf', 'https://tasks.example.com')).toBe(
      'https://tasks.example.com/api/uploads/spec.pdf',
    );
    expect(resolveDocumentLinkHref('projects/TN/docs', 'https://tasks.example.com')).toBe(
      'https://tasks.example.com/projects/TN/docs',
    );
    expect(resolveDocumentLinkHref('https://external.example.com/spec', null)).toBe(
      'https://external.example.com/spec',
    );
    expect(resolveDocumentLinkHref('mailto:ops@example.com', 'https://tasks.example.com')).toBe(
      'mailto:ops@example.com',
    );
  });

  it('rejects document link schemes that native should not open implicitly', () => {
    expect(
      resolveDocumentLinkHref('ftp://files.example.com/spec', 'https://tasks.example.com'),
    ).toBeNull();
    expect(
      resolveDocumentLinkHref('tasknebula://settings', 'https://tasks.example.com'),
    ).toBeNull();
    expect(resolveDocumentLinkHref('/settings/integrations', null)).toBeNull();
  });
});
