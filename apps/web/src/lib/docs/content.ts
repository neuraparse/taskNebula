export interface DocumentHeading {
  id: string;
  text: string;
  level: number;
}

export interface SanitizedPublicAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  publicUrl: string;
}

const INTERNAL_DOC_LINK_PATTERN = /[?&]pageId=([^&]+)/;

export function slugifyDocumentTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'untitled';
}

export function createDefaultDocumentContent(text?: string) {
  const content = text?.trim()
    ? [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ]
    : [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Start writing your team knowledge here.' }],
        },
      ];

  return {
    type: 'doc',
    content,
  };
}

export function createIssueSpecDocumentContent(issue: { key: string; title: string; description?: string | null }) {
  const nodes: Array<Record<string, unknown>> = [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: `${issue.key} Spec` }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: `Linked issue: ${issue.key} — ${issue.title}` }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Context' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: issue.description?.trim() || 'Add context, goals, and constraints.' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Implementation Notes' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Define scope and acceptance criteria.' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Capture open questions and risks.' }],
            },
          ],
        },
      ],
    },
  ];

  return {
    type: 'doc',
    content: nodes,
  };
}

export function createInternalDocumentHref(pageId: string) {
  return `/docs?pageId=${pageId}`;
}

export function createPublicDocumentHref(token: string) {
  return `/share/${token}`;
}

export function createDocumentAppHref(page: {
  id: string;
  spaceId?: string | null;
  projectId?: string | null;
}) {
  const params = new URLSearchParams();
  params.set('pageId', page.id);

  if (page.spaceId) {
    params.set('spaceId', page.spaceId);
  }

  const basePath = page.projectId ? `/projects/${page.projectId}/docs` : '/docs';
  return `${basePath}?${params.toString()}`;
}

export function extractDocumentText(content: unknown): string {
  const parts: string[] = [];

  walkNodes(content, (node) => {
    if (typeof node?.text === 'string') {
      parts.push(node.text);
    }
  });

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractDocumentExcerpt(content: unknown, maxLength = 220): string {
  const text = extractDocumentText(content);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

export function extractInternalDocumentLinkIds(content: unknown): string[] {
  const ids = new Set<string>();

  walkNodes(content, (node) => {
    if (!Array.isArray(node?.marks)) {
      return;
    }

    for (const mark of node.marks) {
      if (mark?.type !== 'link') {
        continue;
      }

      const pageId = getInternalPageIdFromLinkMark(mark);
      if (pageId) {
        ids.add(pageId);
      }
    }
  });

  return [...ids];
}

export function extractDocumentHeadings(content: unknown): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  let count = 0;

  walkNodes(content, (node) => {
    if (node?.type !== 'heading') {
      return;
    }

    const text = collectNodeText(node);
    if (!text) {
      return;
    }

    count += 1;
    headings.push({
      id: `heading-${count}`,
      text,
      level: typeof node?.attrs?.level === 'number' ? node.attrs.level : 1,
    });
  });

  return headings;
}

export function sanitizePublicDocumentContent(
  content: unknown,
  options: {
    pageShareTokensById: Map<string, string>;
    attachmentUrlByPath: Map<string, string>;
    allowAttachments: boolean;
  }
): Record<string, unknown> {
  const sanitized = sanitizeNode(content, options);
  if (sanitized && typeof sanitized === 'object') {
    return sanitized as Record<string, unknown>;
  }

  return { type: 'doc', content: [] };
}

export function getInternalPageIdFromLinkMark(mark: Record<string, any>) {
  if (typeof mark?.attrs?.pageId === 'string' && mark.attrs.pageId.trim()) {
    return mark.attrs.pageId;
  }

  if (typeof mark?.attrs?.href === 'string') {
    const href = mark.attrs.href;
    const match = href.match(INTERNAL_DOC_LINK_PATTERN);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }

    if (href.startsWith('tasknebula://doc/')) {
      return href.replace('tasknebula://doc/', '');
    }
  }

  return null;
}

function sanitizeNode(
  node: unknown,
  options: {
    pageShareTokensById: Map<string, string>;
    attachmentUrlByPath: Map<string, string>;
    allowAttachments: boolean;
  }
): unknown {
  if (Array.isArray(node)) {
    return node
      .map((item) => sanitizeNode(item, options))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  const current = node as Record<string, any>;
  const nextNode: Record<string, any> = { ...current };

  if (current.type === 'image') {
    const src = normalizeUploadPath(current?.attrs?.src);
    if (!src || !options.allowAttachments) {
      return null;
    }

    const publicUrl = options.attachmentUrlByPath.get(src);
    if (!publicUrl) {
      return null;
    }

    nextNode.attrs = {
      ...current.attrs,
      src: publicUrl,
    };
  }

  if (Array.isArray(current.marks)) {
    nextNode.marks = current.marks
      .map((mark: Record<string, any>) => sanitizeMark(mark, options))
      .filter((mark): mark is Record<string, unknown> => Boolean(mark));
  }

  if (Array.isArray(current.content)) {
    nextNode.content = current.content
      .map((child: unknown) => sanitizeNode(child, options))
      .filter((child): child is Record<string, unknown> => Boolean(child));
  }

  return nextNode;
}

function sanitizeMark(
  mark: Record<string, any>,
  options: {
    pageShareTokensById: Map<string, string>;
    attachmentUrlByPath: Map<string, string>;
    allowAttachments: boolean;
  }
) {
  if (mark?.type !== 'link') {
    return mark;
  }

  const pageId = getInternalPageIdFromLinkMark(mark);
  if (pageId) {
    const token = options.pageShareTokensById.get(pageId);
    if (!token) {
      return null;
    }

    return {
      ...mark,
      attrs: {
        href: createPublicDocumentHref(token),
        target: null,
        rel: null,
      },
    };
  }

  const href = sanitizePublicHref(mark?.attrs?.href);
  if (!href) {
    return null;
  }

  return {
    ...mark,
    attrs: {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  };
}

function sanitizePublicHref(href: unknown) {
  if (typeof href !== 'string' || !href.trim()) {
    return null;
  }

  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return null;
}

function normalizeUploadPath(path: unknown) {
  if (typeof path !== 'string' || !path.trim()) {
    return null;
  }

  if (path.startsWith('/api/uploads/')) {
    return path.replace('/api', '');
  }

  if (path.startsWith('/uploads/')) {
    return path;
  }

  return null;
}

function collectNodeText(node: any): string {
  const parts: string[] = [];
  walkNodes(node, (current) => {
    if (typeof current?.text === 'string') {
      parts.push(current.text);
    }
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function walkNodes(node: unknown, visit: (node: any) => void) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkNodes(item, visit);
    }
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  const current = node as Record<string, any>;
  visit(current);

  if (Array.isArray(current.content)) {
    walkNodes(current.content, visit);
  }
}
