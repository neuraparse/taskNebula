'use client';

import { useEffect, useRef, useState } from 'react';
import { useAgentLogs } from '@/lib/hooks/use-agent-logs';
import { useAgentExecution } from '@/lib/hooks/use-agent-execution';
import { AgentStatusBadge } from './agent-status-badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Terminal,
  XCircle,
  Download,
  Trash2,
  CheckCircle2,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ExecutionLogsViewerProps {
  executionId: string;
  className?: string;
}

export function ExecutionLogsViewer({
  executionId,
  className,
}: ExecutionLogsViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: execution } = useAgentExecution(executionId);
  const { logs, isConnected, error, clearLogs } = useAgentLogs(executionId);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const downloadLogs = () => {
    const logText = logs.map((log) => `[${log.timestamp}] ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-execution-${executionId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">Agent Execution Logs</h3>
            {execution && (
              <p className="text-xs text-muted-foreground">
                Execution ID: {executionId.slice(0, 8)}...
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {execution?.status && (
            <AgentStatusBadge status={execution.status as any} />
          )}
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
      </div>

      {/* Execution Info */}
      {execution && (
        <div className="border-b bg-muted/10 px-4 py-2 text-sm">
          <div className="flex flex-wrap gap-4">
            {execution.data?.executorProfile && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Agent:</span>
                <span className="font-medium">
                  {execution.data.executorProfile} {execution.data.executorVariant}
                </span>
              </div>
            )}
            {execution.data?.workspaceId && (
              <div className="flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Workspace:</span>
                <span className="font-mono text-xs">
                  {execution.data.workspaceId.slice(0, 12)}...
                </span>
              </div>
            )}
            {execution.processedOn && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Started:</span>
                <span>{format(new Date(execution.processedOn), 'PPp')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1"
        onScrollCapture={handleScroll}
      >
        <div className="p-4 font-mono text-sm">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span>Error connecting to log stream: {error}</span>
            </div>
          )}

          {logs.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Terminal className="mb-3 h-12 w-12 opacity-20" />
              <p>No logs yet...</p>
              <p className="mt-1 text-xs">
                {isConnected ? 'Waiting for agent output' : 'Connecting to log stream'}
              </p>
            </div>
          )}

          {logs.map((log, index) => (
            <div
              key={index}
              className={cn(
                'py-1',
                log.level === 'error' && 'text-red-600 dark:text-red-400',
                log.level === 'warn' && 'text-yellow-600 dark:text-yellow-400',
                log.level === 'success' && 'text-green-600 dark:text-green-400'
              )}
            >
              <span className="text-muted-foreground">
                [{format(new Date(log.timestamp), 'HH:mm:ss')}]
              </span>{' '}
              <span className="whitespace-pre-wrap break-words">{log.message}</span>
            </div>
          ))}

          {!autoScroll && (
            <div className="sticky bottom-0 mt-4 flex justify-center">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }}
              >
                Scroll to bottom
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
        <div className="text-xs text-muted-foreground">
          {logs.length} log {logs.length === 1 ? 'entry' : 'entries'}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadLogs}
            disabled={logs.length === 0}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>

      {/* Completion Info */}
      {execution?.status === 'completed' && execution.returnvalue?.pullRequestUrl && (
        <div className="border-t bg-green-50 p-4 dark:bg-green-950">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100">
                Agent execution completed successfully!
              </p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                A pull request has been created with the changes.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                asChild
              >
                <a
                  href={execution.returnvalue.pullRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Pull Request
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {execution?.status === 'failed' && execution.failedReason && (
        <div className="border-t bg-red-50 p-4 dark:bg-red-950">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="font-medium text-red-900 dark:text-red-100">
                Agent execution failed
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {execution.failedReason}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
