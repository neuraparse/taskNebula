'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePresence } from '@/lib/hooks/use-presence';
import { cn } from '@/lib/utils';

interface PresenceAvatarsProps {
  issueId: string;
}

export function PresenceAvatars({ issueId }: PresenceAvatarsProps) {
  // Realtime presence hook — not modified; only visual output is changed.
  const { users, count } = usePresence(issueId);

  if (count === 0) {
    return null;
  }

  const visible = users.slice(0, 4);
  const overflow = count - visible.length;

  return (
    <TooltipProvider>
      <div className="flex items-center" role="group" aria-label={`${count} ${count === 1 ? 'person' : 'people'} viewing`}>
        <div className="flex items-center">
          {visible.map((user) => {
            const initials = user.userName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((n: string) => n[0])
              .join('')
              .toUpperCase();

            const isSpeaking = Boolean((user as { isSpeaking?: boolean }).isSpeaking);
            const isActive = Boolean((user as { isActive?: boolean }).isActive) || isSpeaking;

            return (
              <Tooltip key={user.userId}>
                <TooltipTrigger asChild>
                  <Avatar
                    className={cn(
                      '-ml-2 first:ml-0 h-6 w-6 ring-2 ring-background transition-all duration-200',
                      isActive || isSpeaking
                        ? 'ring-accent-emerald shadow-glow'
                        : 'ring-background'
                    )}
                  >
                    <AvatarImage
                      src={`https://avatar.vercel.sh/${user.userName}`}
                      alt={user.userName}
                    />
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {user.userName}
                    {isSpeaking ? ' · speaking' : isActive ? ' · active' : ' · viewing'}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {overflow > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[10px] font-semibold text-muted-foreground cursor-default select-none"
                  aria-label={`${overflow} more`}
                >
                  +{overflow}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{overflow} more viewing</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
