type ProseMirrorNode = {
  type?: unknown;
  text?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  marks?: unknown;
};

type ListKind = 'bulletList' | 'orderedList' | 'taskList';

type PendingList = {
  type: ListKind;
  items: Record<string, unknown>[];
};

function textNode(text: string, marks?: unknown): Record<string, unknown> {
  const node: Record<string, unknown> = { type: 'text', text };
  if (Array.isArray(marks) && marks.length > 0) node.marks = marks;
  return node;
}

function paragraphNode(text: string): Record<string, unknown> {
  return { type: 'paragraph', content: text ? [textNode(text)] : [] };
}

function listItemNode(text: string, checked?: boolean): Record<string, unknown> {
  const node: Record<string, unknown> = {
    type: checked === undefined ? 'listItem' : 'taskItem',
    content: [paragraphNode(text)],
  };
  if (checked !== undefined) node.attrs = { checked };
  return node;
}

function flushParagraph(target: Record<string, unknown>[], lines: string[]) {
  if (lines.length === 0) return;
  target.push(paragraphNode(lines.join(' ').trim()));
  lines.length = 0;
}

function flushList(target: Record<string, unknown>[], pending: PendingList | null): null {
  if (!pending) return null;
  const node: Record<string, unknown> = {
    type: pending.type,
    content: pending.items,
  };
  if (pending.type === 'orderedList') node.attrs = { start: 1 };
  target.push(node);
  return null;
}

function appendListItem(
  target: Record<string, unknown>[],
  pending: PendingList | null,
  type: ListKind,
  text: string,
  checked?: boolean,
): PendingList {
  const next =
    pending?.type === type ? pending : (flushList(target, pending) ?? { type, items: [] });
  next.items.push(listItemNode(text, checked));
  return next;
}

function codeBlockNode(text: string): Record<string, unknown> {
  return { type: 'codeBlock', content: text ? [textNode(text)] : [] };
}

function blockquoteNode(text: string): Record<string, unknown> {
  return { type: 'blockquote', content: [paragraphNode(text)] };
}

export function documentTextToContentJson(text: string): Record<string, unknown> {
  const content: Record<string, unknown>[] = [];
  const paragraphLines: string[] = [];
  let pendingList: PendingList | null = null;
  let codeLines: string[] | null = null;

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      flushParagraph(content, paragraphLines);
      pendingList = flushList(content, pendingList);
      if (codeLines) {
        content.push(codeBlockNode(codeLines.join('\n')));
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(rawLine);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(content, paragraphLines);
      pendingList = flushList(content, pendingList);
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(content, paragraphLines);
      pendingList = flushList(content, pendingList);
      content.push({
        type: 'heading',
        attrs: { level: heading[1]?.length ?? 1 },
        content: [textNode(heading[2] ?? '')],
      });
      continue;
    }

    const taskItem = /^[-*]\s+\[([ xX])]\s+(.+)$/.exec(trimmed);
    if (taskItem) {
      flushParagraph(content, paragraphLines);
      pendingList = appendListItem(
        content,
        pendingList,
        'taskList',
        taskItem[2] ?? '',
        taskItem[1]?.toLowerCase() === 'x',
      );
      continue;
    }

    const bulletItem = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bulletItem) {
      flushParagraph(content, paragraphLines);
      pendingList = appendListItem(content, pendingList, 'bulletList', bulletItem[1] ?? '');
      continue;
    }

    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (orderedItem) {
      flushParagraph(content, paragraphLines);
      pendingList = appendListItem(content, pendingList, 'orderedList', orderedItem[1] ?? '');
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph(content, paragraphLines);
      pendingList = flushList(content, pendingList);
      content.push(blockquoteNode(quote[1] ?? ''));
      continue;
    }

    pendingList = flushList(content, pendingList);
    paragraphLines.push(trimmed);
  }

  if (codeLines) content.push(codeBlockNode(codeLines.join('\n')));
  flushParagraph(content, paragraphLines);
  flushList(content, pendingList);

  return { type: 'doc', content };
}

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
  return Array.isArray(node.content) ? (node.content as ProseMirrorNode[]) : [];
}

function collectNodeText(node: ProseMirrorNode): string {
  if (typeof node.text === 'string') return node.text;
  return childNodes(node)
    .map((child) => collectNodeText(child))
    .filter(Boolean)
    .join('');
}

export function documentContentToPlainText(contentJson: unknown): string {
  const lines: string[] = [];

  const visit = (node: ProseMirrorNode): void => {
    const type = typeof node.type === 'string' ? node.type : '';
    const text = collectNodeText(node).trim();

    if (type === 'heading') {
      const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
      if (text) lines.push(`${'#'.repeat(Math.min(Math.max(level, 1), 3))} ${text}`.trim());
      return;
    }
    if (type === 'paragraph') {
      if (text) lines.push(text);
      return;
    }
    if (type === 'codeBlock') {
      lines.push('```');
      if (text) lines.push(text);
      lines.push('```');
      return;
    }
    if (type === 'blockquote') {
      if (text) lines.push(`> ${text}`);
      return;
    }
    if (type === 'bulletList' || type === 'orderedList' || type === 'taskList') {
      childNodes(node).forEach((child, index) => {
        const itemText = collectNodeText(child).trim();
        if (!itemText) return;
        if (type === 'orderedList') lines.push(`${index + 1}. ${itemText}`);
        else if (type === 'taskList') {
          const checked = child.attrs?.checked === true ? 'x' : ' ';
          lines.push(`- [${checked}] ${itemText}`);
        } else lines.push(`- ${itemText}`);
      });
      return;
    }

    childNodes(node).forEach((child) => visit(child));
  };

  if (contentJson && typeof contentJson === 'object') visit(contentJson as ProseMirrorNode);
  return lines.join('\n\n').trim();
}

export function normalizeDocumentText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function resolveDocumentLinkHref(
  href: unknown,
  baseUrl: string | null | undefined,
): string | null {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return trimmed;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return null;
  if (!baseUrl) return null;

  try {
    return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, baseUrl).toString();
  } catch {
    return null;
  }
}
