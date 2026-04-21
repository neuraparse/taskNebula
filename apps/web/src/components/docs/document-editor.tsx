'use client';

import Link from 'next/link';
import { type ComponentType, type KeyboardEvent, type ReactNode, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { createDocumentAppHref, createInternalDocumentHref } from '@/lib/docs/content';
import { normalizeDocumentPasteHtml, normalizeDocumentPasteText } from '@/lib/docs/paste';
import type { DocumentPage, DocumentShareUpdateInput } from '@/lib/hooks/use-docs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  createDocumentEditorExtensions,
  DOCUMENT_EDITOR_PROSE_CLASSNAME,
} from './document-editor-extensions';
import { DocumentIcon } from './document-icon';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CheckSquare,
  Code2,
  Globe2,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  ExternalLink,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  NotebookText,
  FolderTree,
  RefreshCcw,
  Share2,
  Quote,
  Search,
  Sparkles,
  Table2,
  ImagePlus,
} from 'lucide-react';

const AUTOSAVE_DELAY = 1200;

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface DocumentEditorProps {
  page: DocumentPage;
  allPages: DocumentPage[];
  canEdit: boolean;
  saveError?: string | null;
  onSave: (data: {
    title: string;
    icon: string | null;
    contentJson: Record<string, any>;
    expectedRevision: number;
  }) => Promise<DocumentPage>;
  onUpdateShare?: (data: DocumentShareUpdateInput) => Promise<DocumentPage>;
  onCreateChild?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
}

export function DocumentEditor({
  page,
  allPages,
  canEdit,
  saveError,
  onSave,
  onUpdateShare,
  onCreateChild,
  onUploadImage,
}: DocumentEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(page.title);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    page.updatedAt ? new Date(page.updatedAt) : null
  );
  const [autosaveVersion, setAutosaveVersion] = useState(0);
  const [linkSearch, setLinkSearch] = useState('');
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [slashSearch, setSlashSearch] = useState('');
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    query: string;
    x: number;
    y: number;
    from: number;
    to: number;
  }>({
    open: false,
    query: '',
    x: 0,
    y: 0,
    from: 0,
    to: 0,
  });
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const activePageIdRef = useRef(page.id);
  const titleRef = useRef(page.title);
  const iconRef = useRef<string | null>(page.icon || null);
  const currentRevisionRef = useRef(page.currentRevision);
  const lastServerSnapshotRef = useRef(serializeDocumentSnapshot(page.title, page.icon || null, page.contentJson));
  const lastAutosaveSnapshotRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const slashMenuRef = useRef(slashMenu);
  const slashMenuListRef = useRef<HTMLDivElement>(null);
  const selectedSlashIndexRef = useRef(selectedSlashIndex);
  const filteredSlashCommandsRef = useRef<SlashCommand[]>([]);
  const deferredLinkSearch = useDeferredValue(linkSearch);

  // Stable refs for callbacks that otherwise would need to capture rendering-time values.
  const canEditRef = useRef(canEdit);
  const onUploadImageRef = useRef(onUploadImage);
  const editorRef = useRef<Editor | null>(null);
  const handleImageUploadRef = useRef<(file: File | null) => Promise<void>>(() => Promise.resolve());
  const applySlashCommandRef = useRef<(command: any) => void>(() => {});
  const syncSlashMenuRef = useRef<(editor: Editor | null) => void>(() => {});

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  useEffect(() => {
    onUploadImageRef.current = onUploadImage;
  }, [onUploadImage]);

  const handleImageUpload = useCallback(async (file: File | null) => {
    const activeEditor = editorRef.current;
    const uploader = onUploadImageRef.current;
    if (!file || !activeEditor || !uploader) {
      return;
    }

    try {
      const url = await uploader(file);
      activeEditor.chain().focus().setImage({ src: `/api/uploads/${url.split('/').pop()}`, alt: file.name }).run();
      setIsDirty(true);
      setSaveState('dirty');
      setAutosaveVersion((version) => version + 1);
    } catch (error) {
      toast({
        title: 'Image upload failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    handleImageUploadRef.current = handleImageUpload;
  }, [handleImageUpload]);

  // Extensions: cached at module scope per-option-set, so this ref is stable across renders.
  const editorExtensions = useMemo(
    () => createDocumentEditorExtensions({ placeholder: 'Start writing' }),
    []
  );

  const editorProps = useMemo(
    () => ({
      transformPastedHTML: (html: string) => normalizeDocumentPasteHtml(html),
      transformPastedText: (text: string) => normalizeDocumentPasteText(text),
      handleKeyDown: (_view: unknown, event: globalThis.KeyboardEvent) => {
        if (!slashMenuRef.current.open || filteredSlashCommandsRef.current.length === 0) {
          return false;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedSlashIndex((index) => (index + 1) % filteredSlashCommandsRef.current.length);
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedSlashIndex((index) =>
            index === 0 ? filteredSlashCommandsRef.current.length - 1 : index - 1
          );
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          const command = filteredSlashCommandsRef.current[selectedSlashIndexRef.current];
          if (command) {
            applySlashCommandRef.current(command);
          }
          return true;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setSlashMenu((current) => ({ ...current, open: false }));
          return true;
        }

        return false;
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        if (!canEditRef.current || !onUploadImageRef.current) {
          return false;
        }

        const imageItem = Array.from(event.clipboardData?.items || []).find((item) =>
          item.type.startsWith('image/')
        );
        const file = imageItem?.getAsFile();

        if (!file) {
          return false;
        }

        event.preventDefault();
        void handleImageUploadRef.current(file);
        return true;
      },
      attributes: {
        class: DOCUMENT_EDITOR_PROSE_CLASSNAME,
      },
    }),
    []
  );

  const handleEditorUpdate = useCallback(({ editor }: { editor: Editor }) => {
    const snapshot = serializeDocumentSnapshot(titleRef.current, iconRef.current, editor.getJSON());
    const dirty = snapshot !== lastServerSnapshotRef.current;
    setIsDirty(dirty);
    setSaveState(dirty ? 'dirty' : 'saved');
    setAutosaveVersion((version) => version + 1);
    syncSlashMenuRef.current(editor);
  }, []);

  const handleSelectionUpdate = useCallback(({ editor }: { editor: Editor }) => {
    syncSlashMenuRef.current(editor);
  }, []);

  const editor = useEditor({
    extensions: editorExtensions,
    content: page.contentJson,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: editorProps as any,
    onUpdate: handleEditorUpdate,
    onSelectionUpdate: handleSelectionUpdate,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    slashMenuRef.current = slashMenu;
  }, [slashMenu]);

  useEffect(() => {
    selectedSlashIndexRef.current = selectedSlashIndex;
  }, [selectedSlashIndex]);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashSearch, slashMenu.open]);

  useEffect(() => {
    if (!slashMenu.open) {
      setSlashSearch('');
      return;
    }

    setSlashSearch(slashMenu.query);
  }, [slashMenu.open, slashMenu.query]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(canEdit);
    currentRevisionRef.current = page.currentRevision;

    const incomingSnapshot = serializeDocumentSnapshot(page.title, page.icon || null, page.contentJson);
    const currentSnapshot = serializeDocumentSnapshot(titleRef.current, iconRef.current, editor.getJSON());
    const isNewPage = activePageIdRef.current !== page.id;
    const isAutosaveEcho = incomingSnapshot === lastAutosaveSnapshotRef.current;

    activePageIdRef.current = page.id;
    lastServerSnapshotRef.current = incomingSnapshot;
    setLastSavedAt(page.updatedAt ? new Date(page.updatedAt) : null);

    if (isNewPage) {
      setTitle(page.title);
      titleRef.current = page.title;
      iconRef.current = page.icon || null;
      setLinkSearch('');
      editor.commands.setContent(page.contentJson, false);
      setIsDirty(false);
      setSaveState('saved');
      lastAutosaveSnapshotRef.current = null;
      return;
    }

    if (isAutosaveEcho) {
      if (currentSnapshot === incomingSnapshot) {
        setIsDirty(false);
        setSaveState('saved');
      } else {
        setIsDirty(true);
        setSaveState('dirty');
      }
      return;
    }

    if (currentSnapshot !== incomingSnapshot) {
      setTitle(page.title);
      titleRef.current = page.title;
      iconRef.current = page.icon || null;
      setLinkSearch('');
      editor.commands.setContent(page.contentJson, false);
      setIsDirty(false);
      setSaveState('saved');
      return;
    }

    setIsDirty(false);
    setSaveState('saved');
  }, [page.id, page.title, page.icon, page.contentJson, page.currentRevision, page.updatedAt, canEdit, editor]);

  useEffect(() => {
    if (!editor || !canEdit || !isDirty || isSaving) {
      return;
    }

    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }

    const contentJson = editor.getJSON() as Record<string, any>;
    const snapshot = serializeDocumentSnapshot(nextTitle, iconRef.current, contentJson);

    if (snapshot === lastServerSnapshotRef.current) {
      setIsDirty(false);
      setSaveState('saved');
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistDocument({
        contentJson,
        expectedRevision: currentRevisionRef.current,
        snapshot,
        title: nextTitle,
      });
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timeout);
  }, [autosaveVersion, canEdit, editor, isDirty, isSaving, title]);

  const filteredPages = allPages.filter((candidate) => {
    if (candidate.id === page.id) {
      return false;
    }

    if (!deferredLinkSearch.trim()) {
      return true;
    }

    const normalizedSearch = deferredLinkSearch.toLowerCase();
    return (
      candidate.title.toLowerCase().includes(normalizedSearch) ||
      candidate.slug.toLowerCase().includes(normalizedSearch)
    );
  });
  const childPages = allPages
    .filter((candidate) => candidate.parentId === page.id)
    .sort(sortDocumentPages);
  const breadcrumbPages = buildDocumentBreadcrumbs(page, allPages);

  const statusMeta = getSaveStateMeta(saveState, saveError, lastSavedAt);
  const StatusIcon = statusMeta.icon;
  const internalSharePath = page.share?.internalPath || `/docs?pageId=${page.id}&spaceId=${page.spaceId}`;
  const publicSharePath = page.share?.public?.enabled ? page.share.public.urlPath : null;
  const canManagePublicShare = Boolean(page.share?.canManagePublic && onUpdateShare && canEdit);
  const sharePathForNative = publicSharePath || internalSharePath;
  const documentScopeLabel = page.projectId ? 'Project note' : 'Workspace note';
  const slashMenuLeft =
    typeof window !== 'undefined' ? Math.max(16, Math.min(slashMenu.x, window.innerWidth - 464)) : slashMenu.x;
  const slashMenuTop =
    typeof window !== 'undefined' ? Math.max(16, Math.min(slashMenu.y, window.innerHeight - 520)) : slashMenu.y;
  const slashMenuPosition = (() => {
    if (typeof window === 'undefined') {
      return { left: slashMenuLeft, top: slashMenuTop };
    }

    const container = editorScrollRef.current;
    if (!container) {
      return { left: slashMenuLeft, top: slashMenuTop };
    }

    const containerRect = container.getBoundingClientRect();
    const menuWidth = Math.min(384, Math.max(320, container.clientWidth - 32));
    const menuHeight = 440;

    const left = Math.max(
      16,
      Math.min(
        slashMenu.x - containerRect.left + container.scrollLeft,
        container.scrollLeft + container.clientWidth - menuWidth - 16
      )
    );
    const top = Math.max(
      16,
      Math.min(
        slashMenu.y - containerRect.top + container.scrollTop,
        container.scrollTop + container.clientHeight - menuHeight - 16
      )
    );

    return { left, top };
  })();
  const slashCommands = getSlashCommands();
  const normalizedSlashQuery = slashSearch.trim().toLowerCase();
  const filteredSlashCommands = slashCommands.filter((command) => {
    if (!normalizedSlashQuery) {
      return true;
    }

    return (
      command.title.toLowerCase().includes(normalizedSlashQuery) ||
      command.description.toLowerCase().includes(normalizedSlashQuery) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedSlashQuery))
    );
  });
  filteredSlashCommandsRef.current = filteredSlashCommands;
  const groupedSlashCommands = SLASH_COMMAND_GROUPS.map((group) => ({
    ...group,
    commands: filteredSlashCommands.filter((command) => command.group === group.id),
  })).filter((group) => group.commands.length > 0);

  useEffect(() => {
    if (filteredSlashCommands.length === 0) {
      setSelectedSlashIndex(0);
      return;
    }

    if (selectedSlashIndex >= filteredSlashCommands.length) {
      setSelectedSlashIndex(0);
    }
  }, [filteredSlashCommands.length, selectedSlashIndex]);

  useEffect(() => {
    if (!slashMenu.open || filteredSlashCommands.length === 0) {
      return;
    }

    const selectedItem = slashMenuListRef.current?.querySelector<HTMLElement>(
      `[data-slash-index="${selectedSlashIndex}"]`
    );
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }, [filteredSlashCommands.length, selectedSlashIndex, slashMenu.open]);

  function syncSlashMenu(activeEditor: typeof editor) {
    if (!activeEditor || !canEdit) {
      setSlashMenu((current) => ({
        ...current,
        open: false,
        from: 0,
        to: 0,
      }));
      return;
    }

    const nextState = getSlashMenuState(activeEditor);
    if (!nextState) {
      setSlashMenu((current) => ({
        ...current,
        open: false,
        from: 0,
        to: 0,
      }));
      return;
    }

    setSlashMenu({
      open: true,
      query: nextState.query,
      x: nextState.x,
      y: nextState.y,
      from: nextState.from,
      to: nextState.to,
    });
  }

  function applySlashCommand(command: SlashCommand) {
    if (!editor) {
      return;
    }

    editor
      .chain()
      .focus()
      .deleteRange({ from: slashMenuRef.current.from, to: slashMenuRef.current.to })
      .run();

    command.run(editor);
    setSlashMenu((current) => ({
      ...current,
      open: false,
      from: 0,
      to: 0,
    }));
    setSelectedSlashIndex(0);
  }

  // Expose the latest closures to the memoized editor handlers via refs.
  applySlashCommandRef.current = applySlashCommand;
  syncSlashMenuRef.current = syncSlashMenu;

  function handleSlashSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredSlashCommandsRef.current.length > 0) {
        setSelectedSlashIndex((index) => (index + 1) % filteredSlashCommandsRef.current.length);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredSlashCommandsRef.current.length > 0) {
        setSelectedSlashIndex((index) =>
          index === 0 ? filteredSlashCommandsRef.current.length - 1 : index - 1
        );
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const command = filteredSlashCommandsRef.current[selectedSlashIndexRef.current];
      if (command) {
        applySlashCommand(command);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashMenu((current) => ({ ...current, open: false }));
    }
  }

  async function persistDocument({
    title,
    contentJson,
    expectedRevision,
    snapshot,
  }: {
    title: string;
    contentJson: Record<string, any>;
    expectedRevision: number;
    snapshot: string;
  }) {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    lastAutosaveSnapshotRef.current = snapshot;
    setIsSaving(true);
    setSaveState('saving');

    try {
      const updatedPage = await onSave({
        title,
        contentJson,
        icon: iconRef.current,
        expectedRevision,
      });

      currentRevisionRef.current = updatedPage.currentRevision;
      lastServerSnapshotRef.current = snapshot;
      setLastSavedAt(new Date(updatedPage.updatedAt));

      const latestSnapshot = editor
        ? serializeDocumentSnapshot(titleRef.current, iconRef.current, editor.getJSON())
        : snapshot;

      if (latestSnapshot === snapshot) {
        setIsDirty(false);
        setSaveState('saved');
      } else {
        setIsDirty(true);
        setSaveState('dirty');
      }
    } catch {
      setIsDirty(true);
      setSaveState('error');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function retrySaveNow() {
    if (!editor || !canEdit || !title.trim()) {
      return;
    }

    const contentJson = editor.getJSON() as Record<string, any>;
    const snapshot = serializeDocumentSnapshot(title.trim(), iconRef.current, contentJson);

    await persistDocument({
      title: title.trim(),
      contentJson,
      expectedRevision: currentRevisionRef.current,
      snapshot,
    });
  }

  async function copyUrlValue(urlPath: string, kind: 'link' | 'markdown', label: string) {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${urlPath}` : urlPath;
    const value = kind === 'markdown' ? `[${title.trim() || page.title}](${url})` : url;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined') {
        window.prompt('Copy this share link', value);
      }

      toast({
        title: kind === 'markdown' ? 'Markdown link copied' : `${label} copied`,
        description:
          kind === 'markdown'
            ? 'You can paste it directly into notes or chat.'
            : `${label} is now in your clipboard.`,
      });
    } catch {
      toast({
        title: 'Could not copy link',
        description: 'Clipboard access was blocked in this browser. Try the Open in new tab action instead.',
        variant: 'destructive',
      });
    }
  }

  async function updateShareSettings(data: DocumentShareUpdateInput, successMessage: string) {
    if (!onUpdateShare) {
      return;
    }

    try {
      setIsUpdatingShare(true);
      await onUpdateShare(data);
      toast({
        title: 'Sharing updated',
        description: successMessage,
      });
    } catch (error) {
      toast({
        title: 'Could not update sharing',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingShare(false);
    }
  }

  async function sharePage() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${sharePathForNative}` : sharePathForNative;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: title.trim() || page.title,
          text: 'Shared from TaskNebula Docs',
          url,
        });
        return;
      } catch {
        // Fall back to clipboard when native share is dismissed or unavailable.
      }
    }

    await copyUrlValue(sharePathForNative, 'link', publicSharePath ? 'Public link' : 'Page link');
  }

  const insertInternalLink = (linkedPage: DocumentPage) => {
    if (!editor) {
      return;
    }

    const href = createInternalDocumentHref(linkedPage.id);
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();

    if (selectedText) {
      editor.chain().focus().extendMarkRange('link').setMark('link', { href, pageId: linkedPage.id }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: linkedPage.title,
          marks: [
            {
              type: 'link',
              attrs: { href, pageId: linkedPage.id },
            },
          ],
        })
        .run();
    }

    setLinkSearch('');
  };

  function getSlashCommands(): SlashCommand[] {
    return [
      {
        id: 'text',
        group: 'basic',
        title: 'Text',
        description: 'Start writing in a plain paragraph.',
        keywords: ['paragraph', 'text', 'plain'],
        icon: NotebookText,
        run: (activeEditor) => activeEditor.chain().focus().setParagraph().run(),
      },
      {
        id: 'heading-1',
        group: 'basic',
        title: 'Heading 1',
        description: 'Large page section title.',
        keywords: ['h1', 'title', 'section'],
        icon: Heading1,
        run: (activeEditor) => activeEditor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'heading-2',
        group: 'basic',
        title: 'Heading 2',
        description: 'Medium section heading.',
        keywords: ['h2', 'subtitle'],
        icon: Heading2,
        run: (activeEditor) => activeEditor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'heading-3',
        group: 'basic',
        title: 'Heading 3',
        description: 'Compact subsection heading.',
        keywords: ['h3', 'subheading'],
        icon: Heading3,
        run: (activeEditor) => activeEditor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'bullet-list',
        group: 'lists',
        title: 'Bullet List',
        description: 'Create an unordered list.',
        keywords: ['list', 'bullet', 'ul'],
        icon: List,
        run: (activeEditor) => activeEditor.chain().focus().toggleBulletList().run(),
      },
      {
        id: 'ordered-list',
        group: 'lists',
        title: 'Numbered List',
        description: 'Create a ranked or step-by-step list.',
        keywords: ['list', 'ordered', 'numbered', 'ol'],
        icon: ListOrdered,
        run: (activeEditor) => activeEditor.chain().focus().toggleOrderedList().run(),
      },
      {
        id: 'task-list',
        group: 'lists',
        title: 'Checklist',
        description: 'Track tasks with checkboxes.',
        keywords: ['task', 'todo', 'check', 'checklist'],
        icon: CheckSquare,
        run: (activeEditor) => activeEditor.chain().focus().toggleTaskList().run(),
      },
      {
        id: 'link-page',
        group: 'media',
        title: 'Page Link',
        description: 'Search and link another doc page.',
        keywords: ['link', 'page', 'doc', 'reference'],
        icon: Link2,
        run: () => {
          setLinkSearch('');
          setIsLinkDialogOpen(true);
        },
      },
      {
        id: 'image',
        group: 'media',
        title: 'Image',
        description: 'Upload an image or paste it directly.',
        keywords: ['image', 'photo', 'upload', 'media'],
        icon: ImagePlus,
        run: () => {
          imageInputRef.current?.click();
        },
      },
      {
        id: 'quote',
        group: 'basic',
        title: 'Callout Quote',
        description: 'Highlight a key decision or note.',
        keywords: ['quote', 'callout', 'note'],
        icon: Quote,
        run: (activeEditor) => activeEditor.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'code',
        group: 'structure',
        title: 'Code Block',
        description: 'Insert formatted code or terminal output.',
        keywords: ['code', 'snippet', 'terminal'],
        icon: Code2,
        run: (activeEditor) => activeEditor.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: 'divider',
        group: 'structure',
        title: 'Divider',
        description: 'Separate sections with a rule.',
        keywords: ['divider', 'separator', 'hr'],
        icon: Minus,
        run: (activeEditor) => activeEditor.chain().focus().setHorizontalRule().run(),
      },
      {
        id: 'table',
        group: 'structure',
        title: 'Table',
        description: 'Insert a 3x3 table.',
        keywords: ['table', 'grid'],
        icon: Table2,
        run: (activeEditor) => activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: 'meeting-notes',
        group: 'templates',
        title: 'Meeting Notes',
        description: 'Drop in a quick meeting notes template.',
        keywords: ['template', 'meeting', 'notes', 'agenda'],
        icon: NotebookText,
        run: (activeEditor) =>
          activeEditor
            .chain()
            .focus()
            .insertContent([
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agenda' }] },
              {
                type: 'bulletList',
                content: [
                  { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Add agenda item' }] }] },
                ],
              },
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Capture the key discussion points and outcomes.' }] },
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Follow-ups' }] },
              {
                type: 'taskList',
                content: [
                  {
                    type: 'taskItem',
                    attrs: { checked: false },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Assign next step' }] }],
                  },
                ],
              },
            ])
            .run(),
      },
      {
        id: 'decision-log',
        group: 'templates',
        title: 'Decision Log',
        description: 'Add a lightweight decision record.',
        keywords: ['decision', 'adr', 'record'],
        icon: Sparkles,
        run: (activeEditor) =>
          activeEditor
            .chain()
            .focus()
            .insertContent([
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decision' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Summarize the decision in one sentence.' }] },
              { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Context' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Why this change matters and what constraints shaped it.' }] },
              { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Impact' }] },
              {
                type: 'bulletList',
                content: [
                  { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Teams affected' }] }] },
                  { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Risks or trade-offs' }] }] },
                ],
              },
            ])
            .run(),
      },
    ];
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {canEdit && editor && (
        <div className="shrink-0 border-b border-border bg-background px-4 py-1.5">
          <div className="flex flex-wrap items-center gap-0.5">
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              aria-label="Bold"
              title="Bold"
            >
              <span className="font-bold text-sm leading-none">B</span>
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              aria-label="Italic"
              title="Italic"
            >
              <span className="italic text-sm leading-none">I</span>
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              aria-label="Underline"
              title="Underline"
            >
              <span className="underline text-sm leading-none">U</span>
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              aria-label="Strikethrough"
              title="Strikethrough"
            >
              <span className="line-through text-sm leading-none">S</span>
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              aria-label="Heading 1"
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              aria-label="Heading 2"
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              aria-label="Heading 3"
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              aria-label="Bullet list"
              title="Bullet list"
            >
              <List className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              aria-label="Numbered list"
              title="Numbered list"
            >
              <ListOrdered className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive('taskList')}
              aria-label="Checklist"
              title="Checklist"
            >
              <CheckSquare className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              aria-label="Blockquote"
              title="Blockquote"
            >
              <Quote className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
              aria-label="Code block"
              title="Code block"
            >
              <Code2 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              isActive={false}
              aria-label="Divider"
              title="Divider"
            >
              <Minus className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => { setLinkSearch(''); setIsLinkDialogOpen(true); }}
              isActive={editor.isActive('link')}
              aria-label="Insert page link"
              title="Insert page link"
            >
              <Link2 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => imageInputRef.current?.click()}
              isActive={false}
              aria-label="Upload image"
              title="Upload image"
            >
              <ImagePlus className="h-4 w-4" />
            </MenuBarButton>
          </div>
        </div>
      )}
      <div ref={editorScrollRef} className="animate-fade-up relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 md:px-8 md:py-10">
        {slashMenu.open && (
          <div
            className="surface-card absolute z-50 flex max-h-[440px] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden shadow-md"
            style={{ left: slashMenuPosition.left, top: slashMenuPosition.top }}
          >
            <div className="shrink-0 border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={slashSearch}
                  onChange={(event) => setSlashSearch(event.target.value)}
                  onKeyDown={handleSlashSearchKeyDown}
                  placeholder="Search blocks"
                  className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div ref={slashMenuListRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
              {groupedSlashCommands.length > 0 ? (
                groupedSlashCommands.map((group) => (
                  <div key={group.id} className="pb-1.5 last:pb-0">
                    <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.commands.map((command) => {
                        const index = filteredSlashCommands.findIndex((candidate) => candidate.id === command.id);
                        const isSelected = index === selectedSlashIndex;

                        return (
                          <button
                            key={command.id}
                            type="button"
                            data-slash-index={index}
                            data-selected={isSelected || undefined}
                            className={cn(
                              'flex w-full items-start gap-2.5 rounded-sm px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent/60',
                              isSelected && 'bg-primary/10 text-primary'
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applySlashCommand(command);
                            }}
                          >
                            <command.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{command.title}</div>
                              <div className="truncate text-xs text-muted-foreground">{command.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No matching blocks.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl">
          {page.share?.public?.enabled && (
            <div className="mb-6 flex justify-center">
              <span className="chip-accent">
                <Globe2 className="h-3 w-3" />
                This page is public
              </span>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              {breadcrumbPages.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {breadcrumbPages.map((breadcrumb, index) => (
                    <div key={breadcrumb.id} className="flex items-center gap-1.5">
                      {index > 0 && <span className="text-muted-foreground/50">/</span>}
                      <Link
                        href={createDocumentAppHref({
                          id: breadcrumb.id,
                          spaceId: breadcrumb.spaceId,
                          projectId: breadcrumb.projectId,
                        })}
                        className="inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors duration-150 hover:bg-accent/60 hover:text-foreground"
                      >
                        <span className="max-w-[180px] truncate">{breadcrumb.title}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="kicker">{documentScopeLabel}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusIcon className={cn('h-3.5 w-3.5', statusMeta.iconClassName)} />
                <span>{statusMeta.label}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={isUpdatingShare}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem onClick={() => void sharePage()}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share page
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void copyUrlValue(internalSharePath, 'link', 'Page link')}>
                          <Link2 className="mr-2 h-4 w-4" />
                          Copy workspace link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void copyUrlValue(internalSharePath, 'markdown', 'Workspace markdown link')}>
                          <NotebookText className="mr-2 h-4 w-4" />
                          Copy markdown link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.open(internalSharePath, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open workspace page
                        </DropdownMenuItem>
                        {publicSharePath && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => void copyUrlValue(publicSharePath, 'link', 'Public link')}>
                              <Globe2 className="mr-2 h-4 w-4" />
                              Copy public link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.open(publicSharePath, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open public page
                            </DropdownMenuItem>
                          </>
                        )}
                        {canManagePublicShare && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                void updateShareSettings(
                                  { enablePublic: !page.share?.public?.enabled },
                                  page.share?.public?.enabled
                                    ? 'Public access has been disabled for this page.'
                                    : 'This page is now available on a public link.'
                                )
                              }
                            >
                              <Globe2 className="mr-2 h-4 w-4" />
                              {page.share?.public?.enabled ? 'Disable public access' : 'Enable public access'}
                            </DropdownMenuItem>
                            <DropdownMenuCheckboxItem
                              checked={page.share?.public?.allowSearchIndexing}
                              disabled={!page.share?.public?.enabled || isUpdatingShare}
                              onCheckedChange={(checked) =>
                                void updateShareSettings(
                                  { allowSearchIndexing: Boolean(checked) },
                                  checked
                                    ? 'Search indexing is enabled for the public page.'
                                    : 'Search indexing is disabled for the public page.'
                                )
                              }
                            >
                              Allow search indexing
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              checked={page.share?.public?.includeAttachments}
                              disabled={!page.share?.public?.enabled || isUpdatingShare}
                              onCheckedChange={(checked) =>
                                void updateShareSettings(
                                  { includeAttachments: Boolean(checked) },
                                  checked
                                    ? 'Uploaded attachments can now appear on the public page.'
                                    : 'Uploaded attachments are now hidden from the public page.'
                                )
                              }
                            >
                              Include uploaded attachments
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuItem
                              disabled={!page.share?.public?.enabled || isUpdatingShare}
                              onClick={() =>
                                void updateShareSettings(
                                  { regenerateToken: true, enablePublic: true },
                                  'A fresh public link has been generated and the previous one no longer works.'
                                )
                              }
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Regenerate public link
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

              {onCreateChild && canEdit && (
                <Button variant="outline" size="sm" className="h-8" onClick={onCreateChild}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Sub-note
                </Button>
              )}
              {saveState === 'error' && canEdit && (
                <Button size="sm" className="h-8" onClick={retrySaveNow} disabled={isSaving || !title.trim()}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Retry save
                </Button>
              )}
            </div>
          </div>

          <div>
            {canEdit ? (
              <Input
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  titleRef.current = nextTitle;

                  const snapshot = serializeDocumentSnapshot(nextTitle, iconRef.current, editor?.getJSON() || page.contentJson);
                  const dirty = snapshot !== lastServerSnapshotRef.current;
                  setIsDirty(dirty);
                  setSaveState(dirty ? 'dirty' : 'saved');
                  setAutosaveVersion((version) => version + 1);
                }}
                className="h-auto border-none bg-transparent px-0 text-3xl font-semibold tracking-tight text-foreground shadow-none focus-visible:ring-0"
                placeholder="Untitled page"
              />
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{page.title}</h1>
            )}
          </div>

          {saveError && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="mt-6">
            <EditorContent editor={editor} />
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleImageUpload(event.target.files?.[0] || null);
              event.currentTarget.value = '';
            }}
          />

          {(childPages.length > 0 || (canEdit && onCreateChild)) && (
            <div className="mt-12">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <span>Sub-notes</span>
                  <span className="text-xs font-normal text-muted-foreground">{childPages.length}</span>
                </div>
                {canEdit && onCreateChild && (
                  <Button variant="outline" size="sm" className="h-8" onClick={onCreateChild}>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                )}
              </div>

              {childPages.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {childPages.map((childPage) => (
                    <Link
                      key={childPage.id}
                      href={createDocumentAppHref({
                        id: childPage.id,
                        spaceId: childPage.spaceId,
                        projectId: childPage.projectId,
                      })}
                      className="surface-card surface-card-hover p-5"
                    >
                      <div className="flex items-start gap-3">
                        <DocumentIcon icon={childPage.icon} className="h-8 w-8 rounded-sm text-sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold tracking-tight">{childPage.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {childPage.excerpt || `Updated ${new Date(childPage.updatedAt).toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sub-notes yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link a page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search pages"
              value={linkSearch}
              onChange={(event) => setLinkSearch(event.target.value)}
              autoFocus
            />
            <div className="max-h-[360px] space-y-0.5 overflow-y-auto">
              {filteredPages.length > 0 ? (
                filteredPages.map((linkedPage) => (
                  <button
                    key={linkedPage.id}
                    className="flex w-full items-start gap-2.5 rounded-sm px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent/60"
                    onClick={() => {
                      insertInternalLink(linkedPage);
                      setIsLinkDialogOpen(false);
                    }}
                    type="button"
                  >
                    <DocumentIcon icon={linkedPage.icon} className="h-7 w-7 rounded-sm text-xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{linkedPage.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{linkedPage.slug}</div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching pages.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SlashCommand = {
  id: string;
  group: SlashCommandGroupKey;
  title: string;
  description: string;
  keywords: string[];
  icon: ComponentType<{ className?: string }>;
  run: (editor: Editor) => void;
};

const SLASH_COMMAND_GROUPS = [
  { id: 'basic', label: 'Basics' },
  { id: 'lists', label: 'Lists' },
  { id: 'media', label: 'Media' },
  { id: 'structure', label: 'Structure' },
  { id: 'templates', label: 'Templates' },
] as const;

type SlashCommandGroupKey = (typeof SLASH_COMMAND_GROUPS)[number]['id'];

function getSlashMenuState(editor: Editor) {
  const { selection } = editor.state;
  if (!selection.empty) {
    return null;
  }

  const { $from, from } = selection;
  const parent = $from.parent;
  if (!parent.isTextblock) {
    return null;
  }

  const textBefore = parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
  const match = textBefore.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  if (!match || typeof match.index !== 'number') {
    return null;
  }

  const slashStartInParent = match.index + (match[0].startsWith('/') ? 0 : 1);
  const fromPos = from - ($from.parentOffset - slashStartInParent);
  const coords = editor.view.coordsAtPos(from);

  return {
    query: match[1] || '',
    x: coords.left,
    y: coords.bottom + 10,
    from: fromPos,
    to: from,
  };
}

function serializeDocumentSnapshot(title: string, icon: string | null, contentJson: Record<string, any>) {
  return JSON.stringify({
    title: title.trim(),
    icon: icon || null,
    contentJson,
  });
}

function isDocumentVisuallyEmpty(contentJson: Record<string, any>) {
  const content = Array.isArray(contentJson?.content) ? contentJson.content : [];
  if (content.length === 0) {
    return true;
  }

  return content.every((node) => {
    if (!node || typeof node !== 'object') {
      return true;
    }

    if (node.type !== 'paragraph') {
      return false;
    }

    const childContent = Array.isArray(node.content) ? node.content : [];
    if (childContent.length === 0) {
      return true;
    }

    return childContent.every((child: any) => typeof child?.text === 'string' && !child.text.trim());
  });
}

function sortDocumentPages(left: DocumentPage, right: DocumentPage) {
  const positionDelta = left.position - right.position;
  if (positionDelta !== 0) {
    return positionDelta;
  }

  return left.title.localeCompare(right.title);
}

function buildDocumentBreadcrumbs(page: DocumentPage, pages: DocumentPage[]) {
  const pagesById = new Map(pages.map((candidate) => [candidate.id, candidate]));
  const breadcrumbs: DocumentPage[] = [];
  let cursor = page.parentId ? pagesById.get(page.parentId) || null : null;

  while (cursor) {
    breadcrumbs.unshift(cursor);
    cursor = cursor.parentId ? pagesById.get(cursor.parentId) || null : null;
  }

  return breadcrumbs;
}

function getSaveStateMeta(saveState: SaveState, saveError: string | null | undefined, lastSavedAt: Date | null) {
  if (saveState === 'saving') {
    return {
      icon: Loader2,
      iconClassName: 'animate-spin',
      label: 'Saving changes...',
    };
  }

  if (saveState === 'error' || saveError) {
    return {
      icon: AlertTriangle,
      iconClassName: 'text-destructive',
      label: 'Autosave paused',
    };
  }

  if (saveState === 'dirty') {
    return {
      icon: Check,
      iconClassName: 'text-accent-amber',
      label: 'Waiting to save...',
    };
  }

  return {
    icon: CheckCheck,
    iconClassName: 'text-accent-emerald',
    label: lastSavedAt
      ? `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'All changes saved',
  };
}

function MenuBarButton({
  onClick,
  isActive,
  children,
  'aria-label': ariaLabel,
  title,
}: {
  onClick: () => void;
  isActive: boolean;
  children: ReactNode;
  'aria-label': string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isActive && 'bg-primary/10 text-primary'
      )}
    >
      {children}
    </button>
  );
}

function MenuBarDivider() {
  return <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;
}
