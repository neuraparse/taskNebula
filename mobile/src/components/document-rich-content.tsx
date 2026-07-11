import { useMemo, type ReactNode } from 'react';
import { Linking } from 'react-native';

import { StyleSheet, Text, View } from '@/components/native';
import { getBaseUrl } from '@/api/client';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import { resolveDocumentLinkHref } from '@/lib/document-content';

type RichMark = {
  type?: unknown;
  attrs?: Record<string, unknown>;
};

type RichDocumentNode = {
  type?: unknown;
  text?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  marks?: unknown;
};

function nodeChildren(node: RichDocumentNode): RichDocumentNode[] {
  return Array.isArray(node.content) ? (node.content as RichDocumentNode[]) : [];
}

function nodeMarks(node: RichDocumentNode): RichMark[] {
  return Array.isArray(node.marks) ? (node.marks as RichMark[]) : [];
}

function nodeText(node: RichDocumentNode): string {
  if (typeof node.text === 'string') return node.text;
  return nodeChildren(node)
    .map((child) => nodeText(child))
    .filter(Boolean)
    .join('');
}

type DocumentRichContentStyles = ReturnType<typeof createThemedStyles>;

function markStyle(mark: RichMark, styles: DocumentRichContentStyles) {
  if (mark.type === 'bold') return styles.boldText;
  if (mark.type === 'italic') return styles.italicText;
  if (mark.type === 'underline') return styles.underlineText;
  if (mark.type === 'strike') return styles.strikeText;
  if (mark.type === 'code') return styles.inlineCode;
  if (mark.type === 'link') return styles.linkText;
  return null;
}

function renderInlineNode(
  node: RichDocumentNode,
  key: string,
  styles: DocumentRichContentStyles,
  baseUrl: string | null,
): ReactNode {
  const type = typeof node.type === 'string' ? node.type : '';
  if (type === 'hardBreak') return '\n';
  if (typeof node.text === 'string') {
    const marks = nodeMarks(node);
    const link = marks.find((mark) => mark.type === 'link');
    const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null;
    const resolvedHref = resolveDocumentLinkHref(href, baseUrl);
    const style = marks.map((mark) => markStyle(mark, styles)).filter(Boolean);
    return (
      <Text
        key={key}
        style={style}
        onPress={
          resolvedHref
            ? () => {
                void Linking.openURL(resolvedHref);
              }
            : undefined
        }
      >
        {node.text}
      </Text>
    );
  }
  return nodeChildren(node).map((child, index) =>
    renderInlineNode(child, `${key}-${index}`, styles, baseUrl),
  );
}

function renderInlineContent(
  node: RichDocumentNode,
  keyPrefix: string,
  styles: DocumentRichContentStyles,
  baseUrl: string | null,
): ReactNode[] {
  return nodeChildren(node).map((child, index) =>
    renderInlineNode(child, `${keyPrefix}-${index}`, styles, baseUrl),
  );
}

function renderListItem(
  node: RichDocumentNode,
  prefix: string,
  key: string,
  styles: DocumentRichContentStyles,
  baseUrl: string | null,
): ReactNode {
  const text = nodeText(node).trim();
  if (!text) return null;
  return (
    <View key={key} style={styles.listItem}>
      <Text style={styles.listPrefix}>{prefix}</Text>
      <Text style={styles.bodyText}>{renderInlineContent(node, key, styles, baseUrl)}</Text>
    </View>
  );
}

function renderImage(
  node: RichDocumentNode,
  index: number,
  styles: DocumentRichContentStyles,
): ReactNode {
  const src = typeof node.attrs?.src === 'string' ? node.attrs.src : null;
  const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : null;
  const label = alt || src;
  if (!label) return null;
  return (
    <View key={`image-${index}`} style={styles.imagePlaceholder}>
      <Text style={styles.imageText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function renderBlock(
  node: RichDocumentNode,
  index: number,
  styles: DocumentRichContentStyles,
  baseUrl: string | null,
): ReactNode {
  const type = typeof node.type === 'string' ? node.type : '';
  const text = nodeText(node).trim();
  if (
    !text &&
    !['bulletList', 'orderedList', 'taskList', 'horizontalRule', 'image'].includes(type)
  ) {
    return null;
  }

  if (type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
    return (
      <Text key={`heading-${index}`} style={level <= 1 ? styles.heading1 : styles.heading2}>
        {renderInlineContent(node, `heading-${index}`, styles, baseUrl)}
      </Text>
    );
  }

  if (type === 'blockquote') {
    return (
      <View key={`quote-${index}`} style={styles.quote}>
        <Text style={styles.bodyText}>
          {renderInlineContent(node, `quote-${index}`, styles, baseUrl)}
        </Text>
      </View>
    );
  }

  if (type === 'codeBlock') {
    return (
      <Text key={`code-${index}`} style={styles.codeBlock}>
        {text}
      </Text>
    );
  }

  if (type === 'bulletList' || type === 'orderedList' || type === 'taskList') {
    return (
      <View key={`list-${index}`} style={styles.list}>
        {nodeChildren(node).map((child, childIndex) => {
          if (type === 'orderedList') {
            return renderListItem(
              child,
              `${childIndex + 1}.`,
              `${index}-${childIndex}`,
              styles,
              baseUrl,
            );
          }
          if (type === 'taskList') {
            return renderListItem(
              child,
              child.attrs?.checked === true ? '[x]' : '[ ]',
              `${index}-${childIndex}`,
              styles,
              baseUrl,
            );
          }
          return renderListItem(child, '-', `${index}-${childIndex}`, styles, baseUrl);
        })}
      </View>
    );
  }

  if (type === 'horizontalRule') {
    return <View key={`rule-${index}`} style={styles.rule} />;
  }

  if (type === 'image') {
    return renderImage(node, index, styles);
  }

  return (
    <Text key={`paragraph-${index}`} style={styles.bodyText}>
      {renderInlineContent(node, `paragraph-${index}`, styles, baseUrl)}
    </Text>
  );
}

export function DocumentRichContent({
  baseUrl = getBaseUrl(),
  contentJson,
  fallbackText,
}: {
  baseUrl?: string | null;
  contentJson: unknown;
  fallbackText?: string;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createThemedStyles(colors), [colors]);
  const root =
    contentJson && typeof contentJson === 'object' ? (contentJson as RichDocumentNode) : null;
  const blocks = root
    ? nodeChildren(root).map((node, index) => renderBlock(node, index, styles, baseUrl))
    : [];
  const renderedBlocks = blocks.filter(Boolean);

  if (renderedBlocks.length > 0) {
    return <View style={styles.content}>{renderedBlocks}</View>;
  }

  const fallback = fallbackText?.trim();
  if (!fallback) return null;
  return <Text style={styles.bodyText}>{fallback}</Text>;
}

function createThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 10,
    },
    bodyText: {
      color: colors.foreground,
      fontSize: 15,
      lineHeight: 23,
    },
    heading1: {
      color: colors.foreground,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 29,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 25,
    },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: 10,
    },
    codeBlock: {
      color: colors.foreground,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 19,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    list: {
      gap: 6,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    listPrefix: {
      minWidth: 26,
      color: colors.mutedForeground,
      fontSize: 14,
      lineHeight: 23,
    },
    boldText: {
      fontWeight: '800',
    },
    italicText: {
      fontStyle: 'italic',
    },
    underlineText: {
      textDecorationLine: 'underline',
    },
    strikeText: {
      textDecorationLine: 'line-through',
    },
    inlineCode: {
      color: colors.foreground,
      fontFamily: 'monospace',
      backgroundColor: colors.surface,
    },
    linkText: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    imagePlaceholder: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.surface,
      padding: 10,
    },
    imageText: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 17,
    },
  });
}
