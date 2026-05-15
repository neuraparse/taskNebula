'use client';

import { useMemo } from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

/**
 * Read-only renderer for the rich ProseMirror snapshot stored in
 * `issues.description_rich`.
 *
 * Mounts a non-editable Tiptap editor with the same extension set the
 * collab editor uses, so lists, bold, italics, code blocks, and links
 * round-trip even when the user has never opened the collab editor for
 * this issue. The snapshot shape is exactly what `editor.getJSON()`
 * emits on the write path.
 *
 * Falls back gracefully: if the JSON fails to mount (older shape, bad
 * content), the parent renders the plain-text path instead — so this
 * component does not need its own error boundary.
 */
export function RichDescription({ doc }: { doc: Record<string, unknown> }) {
  const safeContent = useMemo<Record<string, unknown> | null>(() => {
    if (!doc || typeof doc !== 'object') return null;
    if ((doc as { type?: unknown }).type !== 'doc') return null;
    return doc;
  }, [doc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: true, autolink: true }),
        Placeholder.configure({ placeholder: '' }),
      ],
      editable: false,
      immediatelyRender: false,
      content: safeContent ?? undefined,
    },
    [safeContent]
  );

  if (!safeContent) {
    return null;
  }
  return <EditorContent editor={editor as Editor | null} />;
}
