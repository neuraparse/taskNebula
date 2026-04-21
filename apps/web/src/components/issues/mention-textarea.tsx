'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrganizationMembers } from '@/lib/hooks/use-members';
import { cn } from '@/lib/utils';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onMention?: (userId: string) => void;
  placeholder?: string;
  organizationId: string;
  className?: string;
}

export function MentionTextarea({
  value,
  onChange,
  onMention,
  placeholder,
  organizationId,
  className,
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data } = useOrganizationMembers(organizationId);

  const members = data?.members || [];

  const filteredMembers = members.filter((member: any) =>
    member.name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    member.email?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check for @ mention
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space after @
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);

        // Calculate position for mention dropdown
        if (textareaRef.current) {
          const { top, left } = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            top: top + 30,
            left: left + 10,
          });
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (member: any) => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    const newValue =
      textBeforeCursor.slice(0, lastAtIndex) +
      `@${member.name} ` +
      textAfterCursor;

    onChange(newValue);
    setShowMentions(false);
    onMention?.(member.id);

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && (e.key === 'Escape' || e.key === 'Tab')) {
      setShowMentions(false);
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {showMentions && filteredMembers.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-64 rounded-md border border-border bg-card p-1 shadow-sm"
          style={{
            top: '100%',
            left: 0,
          }}
        >
          <Command>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup className="max-h-48 overflow-auto">
              {filteredMembers.map((member: any) => (
                <CommandItem
                  key={member.id}
                  onSelect={() => handleSelectMention(member)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={member.image || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </div>
      )}
    </div>
  );
}

