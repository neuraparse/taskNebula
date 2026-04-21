'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, X, File, Loader2, Download } from 'lucide-react';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  formatFileSize,
} from '@/lib/hooks/use-attachments';

interface IssueAttachmentsProps {
  issueId: string;
}

export function IssueAttachments({ issueId }: IssueAttachmentsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments, isLoading } = useAttachments(issueId);
  const uploadAttachment = useUploadAttachment(issueId);
  const deleteAttachment = useDeleteAttachment(issueId);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file) {
      uploadAttachment.mutate(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = (attachmentId: string) => {
    if (confirm('Are you sure you want to delete this attachment?')) {
      deleteAttachment.mutate(attachmentId);
    }
  };

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Upload Area */}
      <div
        className={`border border-dashed rounded-lg px-4 py-3 text-center transition-colors duration-200 ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-border-strong'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={uploadAttachment.isPending}
        />

        {uploadAttachment.isPending ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop a file or{' '}
              <button
                className="text-primary hover:underline transition-colors duration-200"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
              <span className="ml-1 text-xs text-muted-foreground">(max 10MB)</span>
            </p>
          </div>
        )}
      </div>

      {/* Attachments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors duration-200"
            >
              <File className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild
                >
                  <a
                    href={`/api/uploads/${attachment.filePath.split('/').pop()}`}
                    download={attachment.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deleteAttachment.isPending}
                  aria-label="Delete attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          No attachments yet
        </p>
      )}
    </div>
  );
}

