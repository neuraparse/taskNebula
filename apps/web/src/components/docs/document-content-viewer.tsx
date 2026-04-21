'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { cn } from '@/lib/utils';
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

  return (
    <div className={cn('text-foreground [&_pre]:bg-surface-2 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_code:not(pre_code)]:bg-muted [&_code:not(pre_code)]:px-1 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-xs [&_code:not(pre_code)]:font-mono')}>
      <EditorContent editor={editor} />
    </div>
  );
}
