'use client';

const DISALLOWED_TAGS = new Set([
  'script',
  'style',
  'meta',
  'link',
  'title',
  'iframe',
  'object',
  'embed',
  'noscript',
  'canvas',
  'svg',
  'form',
  'input',
  'textarea',
  'button',
  'select',
  'option',
]);

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
]);

const SAFE_HREF_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
const SAFE_SRC_PROTOCOLS = ['http:', 'https:'];

export function normalizeDocumentPasteText(rawText: string) {
  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeDocumentPasteHtml(rawHtml: string) {
  if (!rawHtml.trim() || typeof DOMParser === 'undefined') {
    return rawHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanClipboardHtml(rawHtml), 'text/html');
  const body = doc.body;

  removeComments(body);

  Array.from(body.querySelectorAll('*'))
    .reverse()
    .forEach((node) => normalizeElement(node as HTMLElement));

  wrapInlineRuns(body);
  removeEmptyNodes(body);

  return body.innerHTML.trim();
}

function cleanClipboardHtml(rawHtml: string) {
  return rawHtml
    .replace(/<!--StartFragment-->|<!--EndFragment-->/gi, '')
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<\/?(html|body)[^>]*>/gi, '');
}

function removeComments(root: HTMLElement) {
  const commentFilter = root.ownerDocument.defaultView?.NodeFilter.SHOW_COMMENT ?? NodeFilter.SHOW_COMMENT;
  const walker = root.ownerDocument.createTreeWalker(root, commentFilter);
  const comments: Comment[] = [];

  while (walker.nextNode()) {
    comments.push(walker.currentNode as Comment);
  }

  comments.forEach((comment) => comment.parentNode?.removeChild(comment));
}

function normalizeElement(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();

  if (DISALLOWED_TAGS.has(tagName)) {
    element.remove();
    return;
  }

  if (tagName === 'b') {
    normalizeElement(replaceTag(element, 'strong'));
    return;
  }

  if (tagName === 'i') {
    normalizeElement(replaceTag(element, 'em'));
    return;
  }

  if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
    normalizeElement(replaceTag(element, 'h3'));
    return;
  }

  if (tagName === 'figure') {
    unwrapElement(element);
    return;
  }

  if (tagName === 'figcaption') {
    normalizeElement(replaceTag(element, 'p'));
    return;
  }

  if (tagName === 'div' || tagName === 'section' || tagName === 'article' || tagName === 'main' || tagName === 'header' || tagName === 'footer' || tagName === 'aside') {
    if (hasOnlyInlineChildren(element)) {
      normalizeElement(replaceTag(element, 'p'));
    } else {
      unwrapElement(element);
    }
    return;
  }

  applyInlineStyleSemantics(element);
  sanitizeElementAttributes(element);

  if ((tagName === 'span' || tagName === 'font') && !hasMeaningfulAttributes(element)) {
    unwrapElement(element);
  }
}

function applyInlineStyleSemantics(element: HTMLElement) {
  const style = (element.getAttribute('style') || '').toLowerCase();
  if (!style) {
    return;
  }

  const wrappers: Array<'strong' | 'em' | 'u' | 's' | 'sub' | 'sup' | 'code' | 'mark'> = [];

  if (/font-weight:\s*(bold|[5-9]00)/.test(style)) {
    wrappers.push('strong');
  }

  if (/font-style:\s*italic/.test(style)) {
    wrappers.push('em');
  }

  if (/text-decoration[^;]*underline/.test(style)) {
    wrappers.push('u');
  }

  if (/text-decoration[^;]*line-through/.test(style)) {
    wrappers.push('s');
  }

  if (/vertical-align:\s*super/.test(style)) {
    wrappers.push('sup');
  }

  if (/vertical-align:\s*sub/.test(style)) {
    wrappers.push('sub');
  }

  if (/font-family:[^;]*(monospace|courier|menlo|consolas|monaco)/.test(style) && element.tagName.toLowerCase() !== 'pre') {
    wrappers.push('code');
  }

  if (/(background|background-color):\s*[^;]+/.test(style)) {
    wrappers.push('mark');
  }

  if (wrappers.length === 0) {
    return;
  }

  let currentContainer: HTMLElement = element;
  wrappers.forEach((tagName) => {
    currentContainer = wrapChildren(element.ownerDocument, currentContainer, tagName);
  });
}

function sanitizeElementAttributes(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const safeStyle = getAllowedStyle(element);

  Array.from(element.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();

    if (name === 'style') {
      if (safeStyle) {
        element.setAttribute('style', safeStyle);
      } else {
        element.removeAttribute(name);
      }
      return;
    }

    if (name === 'href') {
      if (!isSafeUrl(attribute.value, SAFE_HREF_PROTOCOLS)) {
        element.removeAttribute(name);
      }
      return;
    }

    if (name === 'src') {
      if (!isSafeUrl(attribute.value, SAFE_SRC_PROTOCOLS, true)) {
        element.removeAttribute(name);
      }
      return;
    }

    if (name === 'alt' || name === 'title' || name === 'rowspan' || name === 'colspan' || name === 'start') {
      return;
    }

    if (tagName === 'a' && (name === 'target' || name === 'rel')) {
      return;
    }

    element.removeAttribute(name);
  });

  if (tagName === 'a' && !element.getAttribute('href')) {
    unwrapElement(element);
  }

  if (tagName === 'img' && !element.getAttribute('src')) {
    element.remove();
  }
}

function getAllowedStyle(element: HTMLElement) {
  const values: string[] = [];
  const textAlign = element.style.textAlign.trim();

  if (['left', 'center', 'right', 'justify'].includes(textAlign)) {
    values.push(`text-align: ${textAlign}`);
  }

  return values.join('; ');
}

function hasMeaningfulAttributes(element: HTMLElement) {
  return Array.from(element.attributes).some((attribute) => {
    const name = attribute.name.toLowerCase();
    return name === 'href' || name === 'src' || name === 'style';
  });
}

function hasOnlyInlineChildren(element: HTMLElement) {
  return Array.from(element.childNodes).every((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return true;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    return !BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase());
  });
}

function replaceTag(element: HTMLElement, nextTagName: string) {
  const replacement = element.ownerDocument.createElement(nextTagName);

  Array.from(element.attributes).forEach((attribute) => {
    replacement.setAttribute(attribute.name, attribute.value);
  });

  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }

  element.replaceWith(replacement);
  return replacement;
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function wrapChildren(documentRef: Document, element: HTMLElement, tagName: string) {
  const wrapper = documentRef.createElement(tagName);

  while (element.firstChild) {
    wrapper.appendChild(element.firstChild);
  }

  element.appendChild(wrapper);
  return wrapper;
}

function wrapInlineRuns(root: HTMLElement) {
  let activeParagraph: HTMLParagraphElement | null = null;
  const childNodes = Array.from(root.childNodes);

  childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      root.removeChild(node);
      return;
    }

    const isBlockNode =
      node.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase());

    if (isBlockNode) {
      activeParagraph = null;
      return;
    }

    if (!activeParagraph) {
      activeParagraph = root.ownerDocument.createElement('p');
      root.insertBefore(activeParagraph, node);
    }

    activeParagraph.appendChild(node);
  });
}

function removeEmptyNodes(root: HTMLElement) {
  Array.from(root.querySelectorAll('p, span, strong, em, u, s, sub, sup, code, mark')).forEach((node) => {
    const element = node as HTMLElement;
    const hasMedia = element.querySelector('img, br, hr');

    if (!element.textContent?.trim() && !hasMedia) {
      element.remove();
    }
  });
}

function isSafeUrl(value: string, allowedProtocols: string[], allowRelative = false) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  if (allowRelative && (normalizedValue.startsWith('/') || normalizedValue.startsWith('./') || normalizedValue.startsWith('../'))) {
    return true;
  }

  if (normalizedValue.startsWith('#')) {
    return true;
  }

  try {
    const parsed = new URL(normalizedValue, 'https://tasknebula.local');
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}
