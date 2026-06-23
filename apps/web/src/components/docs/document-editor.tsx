'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import type {
  DocumentPage,
  DocumentPageSummary,
  DocumentShareUpdateInput,
} from '@/lib/hooks/use-docs';
import { useToast } from '@/hooks/use-toast';
import { isApiPermissionError } from '@/lib/client-api-errors';
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
  allPages: DocumentPageSummary[];
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
  const t = useTranslations('collab');
  const tHome = useTranslations('pagesHome');
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
  const lastServerSnapshotRef = useRef(
    serializeDocumentSnapshot(page.title, page.icon || null, page.contentJson)
  );
  const lastAutosaveSnapshotRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);
  const slashMenuRef = useRef(slashMenu);
  const slashMenuListRef = useRef<HTMLDivElement>(null);
  const selectedSlashIndexRef = useRef(selectedSlashIndex);
  const filteredSlashCommandsRef = useRef<SlashCommand[]>([]);
  const deferredLinkSearch = useDeferredValue(linkSearch);

  const formatEditorError = useCallback(
    (error: unknown, fallback: string) => {
      if (isApiPermissionError(error)) {
        return tHome('toast_access_denied_description');
      }
      return error instanceof Error ? error.message : fallback;
    },
    [tHome]
  );

  // Stable refs for callbacks that otherwise would need to capture rendering-time values.
  const canEditRef = useRef(canEdit);
  const onUploadImageRef = useRef(onUploadImage);
  const editorRef = useRef<Editor | null>(null);
  const handleImageUploadRef = useRef<(file: File | null) => Promise<void>>(() =>
    Promise.resolve()
  );
  const applySlashCommandRef = useRef<(command: any) => void>(() => {});
  const syncSlashMenuRef = useRef<(editor: Editor | null) => void>(() => {});

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  useEffect(() => {
    onUploadImageRef.current = onUploadImage;
  }, [onUploadImage]);

  const handleImageUpload = useCallback(
    async (file: File | null) => {
      const activeEditor = editorRef.current;
      const uploader = onUploadImageRef.current;
      if (!file || !activeEditor || !uploader) {
        return;
      }

      try {
        const url = await uploader(file);
        activeEditor
          .chain()
          .focus()
          .setImage({ src: `/api/uploads/${url.split('/').pop()}`, alt: file.name })
          .run();
        setIsDirty(true);
        setSaveState('dirty');
        setAutosaveVersion((version) => version + 1);
      } catch (error) {
        toast({
          title: t('editor.toast.imageUploadFailed'),
          description: formatEditorError(error, t('common.somethingWrong')),
          variant: 'destructive',
        });
      }
    },
    [formatEditorError, t, toast]
  );

  useEffect(() => {
    handleImageUploadRef.current = handleImageUpload;
  }, [handleImageUpload]);

  // Extensions: cached at module scope per-option-set, so this ref is stable across renders.
  const editorExtensions = useMemo(
    () => createDocumentEditorExtensions({ placeholder: t('editor.placeholder.startWriting') }),
    [t]
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

    const incomingSnapshot = serializeDocumentSnapshot(
      page.title,
      page.icon || null,
      page.contentJson
    );
    const currentSnapshot = serializeDocumentSnapshot(
      titleRef.current,
      iconRef.current,
      editor.getJSON()
    );
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
  }, [
    page.id,
    page.title,
    page.icon,
    page.contentJson,
    page.currentRevision,
    page.updatedAt,
    canEdit,
    editor,
  ]);

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

  const statusMeta = getSaveStateMeta(saveState, saveError);
  const StatusIcon = statusMeta.icon;
  const statusLabel =
    statusMeta.labelKey === 'saving'
      ? t('editor.status.saving')
      : statusMeta.labelKey === 'paused'
        ? t('editor.status.paused')
        : statusMeta.labelKey === 'waiting'
          ? t('editor.status.waiting')
          : lastSavedAt
            ? t('editor.status.savedAt', {
                time: lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              })
            : t('editor.status.allSaved');
  const internalSharePath =
    page.share?.internalPath || `/docs?pageId=${page.id}&spaceId=${page.spaceId}`;
  const publicSharePath = page.share?.public?.enabled ? page.share.public.urlPath : null;
  const canManagePublicShare = Boolean(page.share?.canManagePublic && onUpdateShare && canEdit);
  const sharePathForNative = publicSharePath || internalSharePath;
  const documentScopeLabel = page.projectId
    ? t('editor.scope.projectNote')
    : t('editor.scope.workspaceNote');
  const slashMenuLeft =
    typeof window !== 'undefined'
      ? Math.max(16, Math.min(slashMenu.x, window.innerWidth - 464))
      : slashMenu.x;
  const slashMenuTop =
    typeof window !== 'undefined'
      ? Math.max(16, Math.min(slashMenu.y, window.innerHeight - 520))
      : slashMenu.y;
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
        window.prompt(t('editor.share.promptCopyShareLink'), value);
      }

      toast({
        title:
          kind === 'markdown'
            ? t('editor.share.toast.markdownCopied')
            : t('editor.share.toast.linkCopied', { label }),
        description:
          kind === 'markdown'
            ? t('editor.share.toast.markdownCopiedBody')
            : t('editor.share.toast.linkCopiedBody', { label }),
      });
    } catch {
      toast({
        title: t('editor.share.toast.copyFailed'),
        description: t('editor.share.toast.copyFailedBody'),
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
        title: t('editor.share.toast.sharingUpdated'),
        description: successMessage,
      });
    } catch (error) {
      toast({
        title: t('editor.share.toast.sharingUpdateFailed'),
        description: formatEditorError(error, t('common.somethingWrong')),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingShare(false);
    }
  }

  async function sharePage() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${sharePathForNative}`
        : sharePathForNative;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: title.trim() || page.title,
          text: t('editor.share.nativeShareText'),
          url,
        });
        return;
      } catch {
        // Fall back to clipboard when native share is dismissed or unavailable.
      }
    }

    await copyUrlValue(
      sharePathForNative,
      'link',
      publicSharePath ? t('editor.share.publicLink') : t('editor.share.pageLink')
    );
  }

  const insertInternalLink = (linkedPage: DocumentPageSummary) => {
    if (!editor) {
      return;
    }

    const href = createInternalDocumentHref(linkedPage.id);
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();

    if (selectedText) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setMark('link', { href, pageId: linkedPage.id })
        .run();
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
        title: t('editor.slash.text.title'),
        description: t('editor.slash.text.description'),
        keywords: ['paragraph', 'text', 'plain'],
        icon: NotebookText,
        run: (activeEditor) => activeEditor.chain().focus().setParagraph().run(),
      },
      {
        id: 'heading-1',
        group: 'basic',
        title: t('editor.slash.heading1.title'),
        description: t('editor.slash.heading1.description'),
        keywords: ['h1', 'title', 'section'],
        icon: Heading1,
        run: (activeEditor) => activeEditor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        id: 'heading-2',
        group: 'basic',
        title: t('editor.slash.heading2.title'),
        description: t('editor.slash.heading2.description'),
        keywords: ['h2', 'subtitle'],
        icon: Heading2,
        run: (activeEditor) => activeEditor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        id: 'heading-3',
        group: 'basic',
        title: t('editor.slash.heading3.title'),
        description: t('editor.slash.heading3.description'),
        keywords: ['h3', 'subheading'],
        icon: Heading3,
        run: (activeEditor) => activeEditor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        id: 'bullet-list',
        group: 'lists',
        title: t('editor.slash.bulletList.title'),
        description: t('editor.slash.bulletList.description'),
        keywords: ['list', 'bullet', 'ul'],
        icon: List,
        run: (activeEditor) => activeEditor.chain().focus().toggleBulletList().run(),
      },
      {
        id: 'ordered-list',
        group: 'lists',
        title: t('editor.slash.orderedList.title'),
        description: t('editor.slash.orderedList.description'),
        keywords: ['list', 'ordered', 'numbered', 'ol'],
        icon: ListOrdered,
        run: (activeEditor) => activeEditor.chain().focus().toggleOrderedList().run(),
      },
      {
        id: 'task-list',
        group: 'lists',
        title: t('editor.slash.taskList.title'),
        description: t('editor.slash.taskList.description'),
        keywords: ['task', 'todo', 'check', 'checklist'],
        icon: CheckSquare,
        run: (activeEditor) => activeEditor.chain().focus().toggleTaskList().run(),
      },
      {
        id: 'link-page',
        group: 'media',
        title: t('editor.slash.pageLink.title'),
        description: t('editor.slash.pageLink.description'),
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
        title: t('editor.slash.image.title'),
        description: t('editor.slash.image.description'),
        keywords: ['image', 'photo', 'upload', 'media'],
        icon: ImagePlus,
        run: () => {
          imageInputRef.current?.click();
        },
      },
      {
        id: 'quote',
        group: 'basic',
        title: t('editor.slash.quote.title'),
        description: t('editor.slash.quote.description'),
        keywords: ['quote', 'callout', 'note'],
        icon: Quote,
        run: (activeEditor) => activeEditor.chain().focus().toggleBlockquote().run(),
      },
      {
        id: 'code',
        group: 'structure',
        title: t('editor.slash.code.title'),
        description: t('editor.slash.code.description'),
        keywords: ['code', 'snippet', 'terminal'],
        icon: Code2,
        run: (activeEditor) => activeEditor.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: 'divider',
        group: 'structure',
        title: t('editor.slash.divider.title'),
        description: t('editor.slash.divider.description'),
        keywords: ['divider', 'separator', 'hr'],
        icon: Minus,
        run: (activeEditor) => activeEditor.chain().focus().setHorizontalRule().run(),
      },
      {
        id: 'table',
        group: 'structure',
        title: t('editor.slash.table.title'),
        description: t('editor.slash.table.description'),
        keywords: ['table', 'grid'],
        icon: Table2,
        run: (activeEditor) =>
          activeEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: 'meeting-notes',
        group: 'templates',
        title: t('editor.slash.meetingNotes.title'),
        description: t('editor.slash.meetingNotes.description'),
        keywords: ['template', 'meeting', 'notes', 'agenda'],
        icon: NotebookText,
        run: (activeEditor) =>
          activeEditor
            .chain()
            .focus()
            .insertContent([
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: t('editor.template.meeting.agenda') }],
              },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: t('editor.template.meeting.agendaItem') }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: t('editor.template.meeting.notes') }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: t('editor.template.meeting.notesBody') }],
              },
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: t('editor.template.meeting.followUps') }],
              },
              {
                type: 'taskList',
                content: [
                  {
                    type: 'taskItem',
                    attrs: { checked: false },
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: t('editor.template.meeting.followUpItem') },
                        ],
                      },
                    ],
                  },
                ],
              },
            ])
            .run(),
      },
      {
        id: 'decision-log',
        group: 'templates',
        title: t('editor.slash.decisionLog.title'),
        description: t('editor.slash.decisionLog.description'),
        keywords: ['decision', 'adr', 'record'],
        icon: Sparkles,
        run: (activeEditor) =>
          activeEditor
            .chain()
            .focus()
            .insertContent([
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: t('editor.template.decision.decision') }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: t('editor.template.decision.decisionBody') }],
              },
              {
                type: 'heading',
                attrs: { level: 3 },
                content: [{ type: 'text', text: t('editor.template.decision.context') }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: t('editor.template.decision.contextBody') }],
              },
              {
                type: 'heading',
                attrs: { level: 3 },
                content: [{ type: 'text', text: t('editor.template.decision.impact') }],
              },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', text: t('editor.template.decision.teamsAffected') },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: t('editor.template.decision.risks') }],
                      },
                    ],
                  },
                ],
              },
            ])
            .run(),
      },
    ];
  }

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      {canEdit && editor && (
        <div className="border-border bg-background shrink-0 border-b px-4 py-1.5">
          <div className="flex flex-wrap items-center gap-0.5">
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              aria-label={t('editor.toolbar.bold')}
              title={t('editor.toolbar.bold')}
            >
              <span className="text-sm font-bold leading-none">{'B'}</span>
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              aria-label={t('editor.toolbar.italic')}
              title={t('editor.toolbar.italic')}
            >
              <span className="text-sm italic leading-none">{'I'}</span>
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              aria-label={t('editor.toolbar.underline')}
              title={t('editor.toolbar.underline')}
            >
              <span className="text-sm leading-none underline">{'U'}</span>
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              aria-label={t('editor.toolbar.strikethrough')}
              title={t('editor.toolbar.strikethrough')}
            >
              <span className="text-sm leading-none line-through">{'S'}</span>
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              aria-label={t('editor.toolbar.heading1')}
              title={t('editor.toolbar.heading1')}
            >
              <Heading1 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              aria-label={t('editor.toolbar.heading2')}
              title={t('editor.toolbar.heading2')}
            >
              <Heading2 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              aria-label={t('editor.toolbar.heading3')}
              title={t('editor.toolbar.heading3')}
            >
              <Heading3 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              aria-label={t('editor.toolbar.bulletList')}
              title={t('editor.toolbar.bulletList')}
            >
              <List className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              aria-label={t('editor.toolbar.numberedList')}
              title={t('editor.toolbar.numberedList')}
            >
              <ListOrdered className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive('taskList')}
              aria-label={t('editor.toolbar.checklist')}
              title={t('editor.toolbar.checklist')}
            >
              <CheckSquare className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              aria-label={t('editor.toolbar.blockquote')}
              title={t('editor.toolbar.blockquote')}
            >
              <Quote className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
              aria-label={t('editor.toolbar.codeBlock')}
              title={t('editor.toolbar.codeBlock')}
            >
              <Code2 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              isActive={false}
              aria-label={t('editor.toolbar.divider')}
              title={t('editor.toolbar.divider')}
            >
              <Minus className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarDivider />
            <MenuBarButton
              onClick={() => {
                setLinkSearch('');
                setIsLinkDialogOpen(true);
              }}
              isActive={editor.isActive('link')}
              aria-label={t('editor.toolbar.insertPageLink')}
              title={t('editor.toolbar.insertPageLink')}
            >
              <Link2 className="h-4 w-4" />
            </MenuBarButton>
            <MenuBarButton
              onClick={() => imageInputRef.current?.click()}
              isActive={false}
              aria-label={t('editor.toolbar.uploadImage')}
              title={t('editor.toolbar.uploadImage')}
            >
              <ImagePlus className="h-4 w-4" />
            </MenuBarButton>
          </div>
        </div>
      )}
      <div
        ref={editorScrollRef}
        className="animate-fade-in relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 md:px-8 md:py-10"
      >
        {slashMenu.open && (
          <div
            className="surface-card absolute z-50 flex max-h-[440px] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden shadow-md"
            style={{ left: slashMenuPosition.left, top: slashMenuPosition.top }}
          >
            <div className="border-border shrink-0 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <input
                  value={slashSearch}
                  onChange={(event) => setSlashSearch(event.target.value)}
                  onKeyDown={handleSlashSearchKeyDown}
                  placeholder={t('editor.slash.searchPlaceholder')}
                  className="placeholder:text-muted-foreground h-8 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>
            <div
              ref={slashMenuListRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5"
            >
              {groupedSlashCommands.length > 0 ? (
                groupedSlashCommands.map((group) => (
                  <div key={group.id} className="pb-1.5 last:pb-0">
                    <div className="text-muted-foreground px-3 pb-1 pt-2 text-[11px] font-medium">
                      {t(`editor.group.${group.id}`)}
                    </div>
                    <div className="space-y-0.5">
                      {group.commands.map((command) => {
                        const index = filteredSlashCommands.findIndex(
                          (candidate) => candidate.id === command.id
                        );
                        const isSelected = index === selectedSlashIndex;

                        return (
                          <button
                            key={command.id}
                            type="button"
                            data-slash-index={index}
                            data-selected={isSelected || undefined}
                            className={cn(
                              'hover:bg-accent/60 flex w-full items-start gap-2.5 rounded-sm px-3 py-1.5 text-left text-sm transition-colors duration-150',
                              isSelected && 'bg-primary/10 text-primary'
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applySlashCommand(command);
                            }}
                          >
                            <command.icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{command.title}</div>
                              <div className="text-muted-foreground truncate text-xs">
                                {command.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground px-4 py-10 text-center text-sm">
                  {t('editor.slash.noMatches')}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl">
          {page.share?.public?.enabled && (
            <div className="mb-6 flex justify-center">
              <span className="chip-emerald">
                <Globe2 className="h-3 w-3" />
                {t('editor.publicBadge')}
              </span>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                <Link
                  href="/docs"
                  className="hover:bg-accent/60 hover:text-foreground inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors duration-150"
                >
                  <span>{t('editor.breadcrumbPages')}</span>
                </Link>
                {breadcrumbPages.length > 0 ? (
                  breadcrumbPages.map((breadcrumb) => (
                    <div key={breadcrumb.id} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground/50">{'/'}</span>
                      <Link
                        href={createDocumentAppHref({
                          id: breadcrumb.id,
                          spaceId: breadcrumb.spaceId,
                          projectId: breadcrumb.projectId,
                        })}
                        className="hover:bg-accent/60 hover:text-foreground inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors duration-150"
                      >
                        <span className="max-w-[180px] truncate">{breadcrumb.title}</span>
                      </Link>
                    </div>
                  ))
                ) : (
                  <>
                    <span className="text-muted-foreground/50">{'/'}</span>
                    <span className="kicker">{documentScopeLabel}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                aria-live="polite"
                className={cn(
                  'ease-snap inline-flex items-center gap-1.5 transition-all duration-150',
                  statusMeta.chipClassName
                )}
              >
                <StatusIcon className={cn('h-3 w-3', statusMeta.iconClassName)} />
                <span>{statusLabel}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8" disabled={isUpdatingShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {t('editor.share.button')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => void sharePage()}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {t('editor.share.sharePage')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void copyUrlValue(internalSharePath, 'link', t('editor.share.pageLink'))
                    }
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {t('editor.share.copyWorkspaceLink')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void copyUrlValue(
                        internalSharePath,
                        'markdown',
                        t('editor.share.workspaceMarkdownLink')
                      )
                    }
                  >
                    <NotebookText className="mr-2 h-4 w-4" />
                    {t('editor.share.copyMarkdownLink')}
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
                    {t('editor.share.openWorkspacePage')}
                  </DropdownMenuItem>
                  {publicSharePath && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          void copyUrlValue(publicSharePath, 'link', t('editor.share.publicLink'))
                        }
                      >
                        <Globe2 className="mr-2 h-4 w-4" />
                        {t('editor.share.copyPublicLink')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open(publicSharePath, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('editor.share.openPublicPage')}
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
                              ? t('editor.share.msg.publicDisabled')
                              : t('editor.share.msg.publicEnabled')
                          )
                        }
                      >
                        <Globe2 className="mr-2 h-4 w-4" />
                        {page.share?.public?.enabled
                          ? t('editor.share.disablePublic')
                          : t('editor.share.enablePublic')}
                      </DropdownMenuItem>
                      <DropdownMenuCheckboxItem
                        checked={page.share?.public?.allowSearchIndexing}
                        disabled={!page.share?.public?.enabled || isUpdatingShare}
                        onCheckedChange={(checked) =>
                          void updateShareSettings(
                            { allowSearchIndexing: Boolean(checked) },
                            checked
                              ? t('editor.share.msg.indexingEnabled')
                              : t('editor.share.msg.indexingDisabled')
                          )
                        }
                      >
                        {t('editor.share.allowIndexing')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={page.share?.public?.includeAttachments}
                        disabled={!page.share?.public?.enabled || isUpdatingShare}
                        onCheckedChange={(checked) =>
                          void updateShareSettings(
                            { includeAttachments: Boolean(checked) },
                            checked
                              ? t('editor.share.msg.attachmentsShown')
                              : t('editor.share.msg.attachmentsHidden')
                          )
                        }
                      >
                        {t('editor.share.includeAttachments')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuItem
                        disabled={!page.share?.public?.enabled || isUpdatingShare}
                        onClick={() =>
                          void updateShareSettings(
                            { regenerateToken: true, enablePublic: true },
                            t('editor.share.msg.regenerated')
                          )
                        }
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {t('editor.share.regeneratePublic')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {onCreateChild && canEdit && (
                <Button variant="outline" size="sm" className="h-8" onClick={onCreateChild}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  {t('editor.subNote')}
                </Button>
              )}
              {saveState === 'error' && canEdit && (
                <Button
                  size="sm"
                  className="h-8"
                  onClick={retrySaveNow}
                  disabled={isSaving || !title.trim()}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {t('editor.retrySave')}
                </Button>
              )}
            </div>
          </div>

          <div>
            {page.icon && (
              <div className="mb-3">
                <span
                  aria-label={t('editor.pageIcon')}
                  className="inline-flex select-none items-center justify-center rounded-lg p-1 text-[56px] leading-none transition-colors"
                >
                  {page.icon}
                </span>
              </div>
            )}
            {canEdit ? (
              <Input
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  titleRef.current = nextTitle;

                  const snapshot = serializeDocumentSnapshot(
                    nextTitle,
                    iconRef.current,
                    editor?.getJSON() || page.contentJson
                  );
                  const dirty = snapshot !== lastServerSnapshotRef.current;
                  setIsDirty(dirty);
                  setSaveState(dirty ? 'dirty' : 'saved');
                  setAutosaveVersion((version) => version + 1);
                }}
                className="text-foreground h-auto border-none bg-transparent px-0 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
                placeholder={t('editor.untitledPage')}
              />
            ) : (
              <h1 className="text-foreground text-balance text-3xl font-semibold tracking-tight">
                {page.title}
              </h1>
            )}
          </div>

          {saveError && (
            <div className="border-destructive/20 bg-destructive/5 text-destructive mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-sm">
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
                  <FolderTree className="text-muted-foreground h-4 w-4" />
                  <span>{t('editor.subNotes')}</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {childPages.length}
                  </span>
                </div>
                {canEdit && onCreateChild && (
                  <Button variant="outline" size="sm" className="h-8" onClick={onCreateChild}>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    {t('editor.add')}
                  </Button>
                )}
              </div>

              {childPages.length > 0 ? (
                <div className="stagger grid gap-3 md:grid-cols-2">
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
                        <DocumentIcon
                          icon={childPage.icon}
                          className="h-8 w-8 rounded-sm text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold tracking-tight">
                            {childPage.title}
                          </div>
                          <div className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                            {childPage.excerpt ||
                              t('editor.updatedOn', {
                                date: new Date(childPage.updatedAt).toLocaleDateString(),
                              })}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('editor.noSubNotes')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editor.linkDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('editor.linkDialog.searchPages')}
              value={linkSearch}
              onChange={(event) => setLinkSearch(event.target.value)}
              autoFocus
            />
            <div className="max-h-[360px] space-y-0.5 overflow-y-auto">
              {filteredPages.length > 0 ? (
                filteredPages.map((linkedPage) => (
                  <button
                    key={linkedPage.id}
                    className="row-interactive flex w-full items-start gap-2.5 px-3 py-1.5 text-left text-sm"
                    onClick={() => {
                      insertInternalLink(linkedPage);
                      setIsLinkDialogOpen(false);
                    }}
                    type="button"
                  >
                    <DocumentIcon icon={linkedPage.icon} className="h-7 w-7 rounded-sm text-xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{linkedPage.title}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {linkedPage.slug}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  {t('editor.linkDialog.noMatches')}
                </p>
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

function serializeDocumentSnapshot(
  title: string,
  icon: string | null,
  contentJson: Record<string, any>
) {
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

    return childContent.every(
      (child: any) => typeof child?.text === 'string' && !child.text.trim()
    );
  });
}

function sortDocumentPages(left: DocumentPageSummary, right: DocumentPageSummary) {
  const positionDelta = left.position - right.position;
  if (positionDelta !== 0) {
    return positionDelta;
  }

  return left.title.localeCompare(right.title);
}

function buildDocumentBreadcrumbs(page: DocumentPage, pages: DocumentPageSummary[]) {
  const pagesById = new Map(pages.map((candidate) => [candidate.id, candidate]));
  const breadcrumbs: DocumentPageSummary[] = [];
  let cursor = page.parentId ? pagesById.get(page.parentId) || null : null;

  while (cursor) {
    breadcrumbs.unshift(cursor);
    cursor = cursor.parentId ? pagesById.get(cursor.parentId) || null : null;
  }

  return breadcrumbs;
}

function getSaveStateMeta(saveState: SaveState, saveError: string | null | undefined) {
  if (saveState === 'saving') {
    return {
      icon: Loader2,
      iconClassName: 'animate-spin',
      chipClassName: 'chip-amber',
      labelKey: 'saving' as const,
    };
  }

  if (saveState === 'error' || saveError) {
    return {
      icon: AlertTriangle,
      iconClassName: 'text-destructive',
      chipClassName: 'chip-rose',
      labelKey: 'paused' as const,
    };
  }

  if (saveState === 'dirty') {
    return {
      icon: Check,
      iconClassName: 'text-accent-amber',
      chipClassName: 'chip-amber',
      labelKey: 'waiting' as const,
    };
  }

  return {
    icon: CheckCheck,
    iconClassName: 'text-accent-emerald',
    chipClassName: 'chip-emerald',
    labelKey: 'saved' as const,
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
        'text-muted-foreground hover:bg-accent/60 focus-visible:ring-ring inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isActive && 'bg-primary/10 text-primary'
      )}
    >
      {children}
    </button>
  );
}

function MenuBarDivider() {
  return <div className="bg-border mx-1 h-5 w-px" aria-hidden="true" />;
}
