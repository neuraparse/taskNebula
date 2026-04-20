'use client';

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';

// Only register the grammars actually exposed via DOCUMENT_CODE_LANGUAGES below.
// `common` from lowlight ships 37 grammars (~200KB gzip); filtering the map keeps the
// createLowlight registration cost to the 9 we actually expose in the code block menu.
const DOCUMENT_LOWLIGHT_GRAMMAR_KEYS = [
  'bash',
  'javascript',
  'typescript',
  'json',
  'sql',
  'markdown',
  'xml',
  'css',
  'python',
] as const;

const documentLowlightGrammars = Object.fromEntries(
  Object.entries(common).filter(([key]) =>
    (DOCUMENT_LOWLIGHT_GRAMMAR_KEYS as readonly string[]).includes(key)
  )
);

const lowlight = createLowlight(documentLowlightGrammars);

export const DOCUMENT_EDITOR_PROSE_CLASSNAME =
  "min-h-[640px] w-full max-w-none focus:outline-none px-1 py-2 text-base leading-8 text-foreground [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-[2.9rem] [&_h1]:font-semibold [&_h1]:tracking-[-0.03em] [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-[2rem] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-[1.35rem] [&_h3]:font-semibold [&_h3]:tracking-tight [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_blockquote]:my-6 [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:bg-transparent [&_blockquote]:py-3 [&_blockquote]:pl-5 [&_blockquote]:pr-4 [&_blockquote]:text-muted-foreground [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-muted/10 [&_pre]:p-5 [&_pre]:text-sm [&_pre]:text-foreground [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_code]:rounded-sm [&_code]:bg-muted/20 [&_code]:px-1.5 [&_code]:py-0.5 [&_mark]:rounded-sm [&_mark]:bg-amber-200/80 [&_mark]:px-1 [&_mark]:text-foreground dark:[&_mark]:bg-amber-400/25 dark:[&_mark]:text-amber-50 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_hr]:my-9 [&_hr]:border-border/70 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/70 [&_td]:p-2.5 [&_th]:border [&_th]:border-border/70 [&_th]:bg-muted/10 [&_th]:p-2.5 [&_img]:my-7 [&_img]:max-h-96 [&_img]:w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border/60 [&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0 [&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-3 [&_ul[data-type='taskList']_li>label]:mt-1 [&_ul[data-type='taskList']_li>div]:flex-1";

export const DOCUMENT_CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'bash', label: 'Bash' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
] as const;

export const InternalLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      pageId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-page-id'),
        renderHTML: (attributes) => {
          if (!attributes.pageId) {
            return {};
          }

          return {
            'data-page-id': attributes.pageId,
          };
        },
      },
    };
  },
});

// Module-scope, pre-configured extensions. Every field here is option-independent, so
// there is no reason to reconstruct them on every render of the editor component.
const STARTER_KIT_EXTENSION = StarterKit.configure({
  heading: {
    levels: [1, 2, 3],
  },
  codeBlock: false,
});

const CODE_BLOCK_EXTENSION = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: 'plaintext',
});

const HIGHLIGHT_EXTENSION = Highlight.configure({ multicolor: true });

const TASK_ITEM_EXTENSION = TaskItem.configure({ nested: true });

const TEXT_ALIGN_EXTENSION = TextAlign.configure({
  types: ['heading', 'paragraph'],
  defaultAlignment: 'left',
});

const TABLE_EXTENSION = Table.configure({ resizable: true });

const IMAGE_EXTENSION = Image.configure({
  inline: false,
  allowBase64: false,
});

// Shared, immutable list of extensions that do not depend on caller-provided options.
const DOCUMENT_BASE_EXTENSIONS: any[] = [
  STARTER_KIT_EXTENSION,
  CODE_BLOCK_EXTENSION,
  Underline,
  HIGHLIGHT_EXTENSION,
  Subscript,
  Superscript,
  TaskList,
  TASK_ITEM_EXTENSION,
  TEXT_ALIGN_EXTENSION,
  TABLE_EXTENSION,
  TableRow,
  TableHeader,
  TableCell,
  IMAGE_EXTENSION,
];

// Cache option-dependent extension arrays so repeated calls with the same options
// return a stable reference (keeps `useEditor`'s extensions array stable across renders).
const extensionCache = new Map<string, any[]>();

export function createDocumentEditorExtensions(options?: {
  placeholder?: string;
  openLinksOnClick?: boolean;
}) {
  const openLinksOnClick = options?.openLinksOnClick ?? false;
  const placeholder = options?.placeholder;
  const cacheKey = `${openLinksOnClick ? '1' : '0'}|${placeholder ?? ''}|${placeholder === undefined ? '0' : '1'}`;

  const cached = extensionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const extensions: any[] = [
    ...DOCUMENT_BASE_EXTENSIONS,
    InternalLink.configure({
      openOnClick: openLinksOnClick,
      autolink: false,
    }),
  ];

  if (placeholder !== undefined) {
    extensions.push(
      Placeholder.configure({
        placeholder,
      })
    );
  }

  extensionCache.set(cacheKey, extensions);
  return extensions;
}
