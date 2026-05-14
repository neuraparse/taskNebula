'use client';

/**
 * Collaborative replacement for the plain-textarea issue description editor.
 *
 * Mounted in place of the static editor when `NEXT_PUBLIC_COLLAB_ENABLED=true`
 * (see {@link IssueContent}). Falls back to a read-only message if either the
 * env flag or the Hocuspocus URL is missing so the surrounding UI never
 * crashes when the optional collab service is not deployed.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import {
  createCollabProvider,
  presenceColorFor,
  resolveHocuspocusUrl,
  type CollabProviderHandle,
} from '@/lib/collab/yjs-provider';

export interface CollabDescriptionEditorProps {
  issueId: string;
  initialContent: string;
  canEdit: boolean;
  onSave: (next: string) => Promise<void>;
  isSaving?: boolean;
  placeholder?: string;
}

async function fetchCollabToken(): Promise<{ token: string; user: { id: string; name: string } } | null> {
  const response = await fetch('/api/collab/token', { method: 'POST' });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export function CollabDescriptionEditor({
  issueId,
  initialContent,
  canEdit,
  onSave,
  isSaving,
  placeholder = 'Write a description...',
}: CollabDescriptionEditorProps) {
  const { data: session } = useSession();
  const [handle, setHandle] = useState<CollabProviderHandle | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const handleRef = useRef<CollabProviderHandle | null>(null);

  const documentName = useMemo(() => `issue:${issueId}`, [issueId]);
  const hocuspocusConfigured = resolveHocuspocusUrl() !== null;

  // Fetch a fresh token whenever the session resolves to a logged-in user.
  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id || !hocuspocusConfigured) {
      return;
    }
    void fetchCollabToken().then((result) => {
      if (cancelled || !result) return;
      setToken(result.token);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, hocuspocusConfigured]);

  // Build the provider once we have a token.
  useEffect(() => {
    if (!token) return;
    const next = createCollabProvider({ documentName, token });
    if (!next) return;
    handleRef.current = next;
    setHandle(next);

    const onStatus = (event: { status: string }) => {
      setConnectionState(event.status === 'connected' ? 'connected' : 'connecting');
    };
    const onDisconnect = () => setConnectionState('disconnected');

    next.provider.on('status', onStatus);
    next.provider.on('disconnect', onDisconnect);

    return () => {
      next.provider.off('status', onStatus);
      next.provider.off('disconnect', onDisconnect);
      next.destroy();
      handleRef.current = null;
    };
  }, [token, documentName]);

  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        history: false, // Collaboration provides its own history.
      }),
      Placeholder.configure({ placeholder }),
    ];
    if (handle) {
      base.push(
        Collaboration.configure({ document: handle.doc }) as any,
        CollaborationCursor.configure({
          provider: handle.provider,
          user: {
            name: session?.user?.name || session?.user?.email || 'Anonymous',
            color: presenceColorFor(session?.user?.id || session?.user?.email || 'anon'),
          },
        }) as any
      );
    }
    return base;
  }, [handle, placeholder, session?.user?.id, session?.user?.email, session?.user?.name]);

  const editor = useEditor(
    {
      extensions,
      editable: canEdit,
      immediatelyRender: false,
      content: handle ? undefined : initialContent,
    },
    [handle, canEdit]
  );

  // Seed the doc with the persisted description the first time a client
  // attaches to an empty Yjs document. Without this the editor would appear
  // blank for the first collaborator after a server restart.
  useEffect(() => {
    if (!editor || !handle) return;
    const onSynced = () => {
      if (editor.isDestroyed) return;
      const text = editor.getText().trim();
      if (!text && initialContent.trim()) {
        editor.commands.setContent(initialContent, false);
      }
    };
    handle.provider.on('synced', onSynced);
    return () => {
      handle.provider.off('synced', onSynced);
    };
  }, [editor, handle, initialContent]);

  if (!hocuspocusConfigured) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Collaboration is enabled, but <code>NEXT_PUBLIC_HOCUSPOCUS_URL</code> is
        not configured. Description editing is temporarily disabled.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <ConnectionPill state={connectionState} />
        {canEdit && editor && (
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => void onSave(serializeEditorContent(editor))}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3 w-3" />
            )}
            Save snapshot
          </Button>
        )}
      </div>
      <div className="prose prose-sm max-w-none dark:prose-invert min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ConnectionPill({ state }: { state: 'connecting' | 'connected' | 'disconnected' }) {
  const label =
    state === 'connected' ? 'Live' : state === 'connecting' ? 'Connecting...' : 'Offline';
  const tone =
    state === 'connected'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
      : state === 'connecting'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function serializeEditorContent(editor: Editor): string {
  // Persist as plain text so the existing description column (string) keeps
  // working. The Yjs doc remains the source of truth for live edits; the
  // snapshot is only used to render the read-only fallback and to seed new
  // collaborators.
  return editor.getText();
}
