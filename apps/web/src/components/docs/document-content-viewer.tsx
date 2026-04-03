'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import {
  createDocumentEditorExtensions,
  DOCUMENT_EDITOR_PROSE_CLASSNAME,
} from './document-editor-extensions';

interface DocumentContentViewerProps {
  content: Record<string, any>;
  className?: string;
}

export function DocumentContentViewer({ content, className }: DocumentContentViewerProps) {
  const editor = useEditor({
    extensions: createDocumentEditorExtensions({
      placeholder: '',
      openLinksOnClick: true,
    }),
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${DOCUMENT_EDITOR_PROSE_CLASSNAME} ${className || ''}`.trim(),
      },
    },
  });

  return <EditorContent editor={editor} />;
}
