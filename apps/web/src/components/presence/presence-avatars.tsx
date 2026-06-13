'use client';

import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePresence } from '@/lib/hooks/use-presence';
import { cn } from '@/lib/utils';

interface PresenceAvatarsProps {
  issueId: string;
}

export function PresenceAvatars({ issueId }: PresenceAvatarsProps) {
  const t = useTranslations('presence');
  // Realtime presence hook — not modified; only visual output is changed.
  const { users, count } = usePresence(issueId);

  if (count === 0) {
    return null;
  }

  const visible = users.slice(0, 4);
  const overflow = count - visible.length;

  return (
    <TooltipProvider>
      <div className="flex items-center" role="group" aria-label={t('group_viewing', { count })}>
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
                  <span className="relative -ml-1.5 inline-flex first:ml-0">
                    <Avatar
                      className={cn(
                        'ring-background ease-snap h-6 w-6 ring-2 transition-all duration-150',
                        isActive || isSpeaking ? 'ring-accent-emerald/70' : 'ring-background'
                      )}
                    >
                      <AvatarImage
                        src={`https://avatar.vercel.sh/${user.userName}`}
                        alt={user.userName}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isSpeaking || isActive ? (
                      <span className="realtime-ping text-accent-emerald absolute -bottom-0.5 -right-0.5">
                        <span
                          className="status-dot status-live ring-background ring-2"
                          aria-hidden
                        />
                      </span>
                    ) : (
                      <span
                        className="status-dot status-idle ring-background absolute -bottom-0.5 -right-0.5 ring-2"
                        aria-hidden
                      />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {user.userName}
                    {' · '}
                    {isSpeaking
                      ? t('status_speaking')
                      : isActive
                        ? t('status_active')
                        : t('status_viewing')}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {overflow > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="ring-background bg-muted text-muted-foreground -ml-1.5 flex h-6 w-6 cursor-default select-none items-center justify-center rounded-full text-[10px] font-semibold ring-2"
                  aria-label={t('overflow_more', { count: overflow })}
                >
                  {'+'}
                  {overflow}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{t('overflow_more_viewing', { count: overflow })}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
