'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePresence } from '@/lib/hooks/use-presence';
import { Eye } from 'lucide-react';

interface PresenceAvatarsProps {
  issueId: string;
}

export function PresenceAvatars({ issueId }: PresenceAvatarsProps) {
  const { users, count } = usePresence(issueId);

  if (count === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((user) => {
            const initials = user.userName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Tooltip key={user.userId}>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={`https://avatar.vercel.sh/${user.userName}`} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{user.userName} is viewing</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {count > 3 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                  +{count - 3}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{count - 3} more viewing</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

