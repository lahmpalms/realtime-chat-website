'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Message } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { usePrefersReducedMotion } from '@/lib/hooks/useResponsive';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export function MessageItem({ 
  message, 
  isOwnMessage, 
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true 
}: MessageItemProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const getInitials = (name: string): string => {
    try {
      return name
        .trim()
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';
    } catch {
      return '??';
    }
  };

  const formatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      const relative = formatDistanceToNow(date, { addSuffix: true });
      const absolute = date.toLocaleString();
      return { relative, absolute };
    } catch {
      return { relative: 'just now', absolute: 'unknown time' };
    }
  };
  
  const timeData = formatTime(message.timestamp);

  return (
    <article 
      className={cn(
        'flex gap-3 sm:gap-4 group transition-all duration-200',
        isOwnMessage ? 'flex-row-reverse' : 'flex-row',
        prefersReducedMotion && 'transition-none',
        'hover:bg-muted/20 rounded-lg p-2 -m-2'
      )}
      role="article"
      aria-label={`Message from ${message.userName} ${timeData.relative}`}
    >
      {/* Avatar */}
      {showAvatar && (
        <div className="flex-shrink-0">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
            <AvatarFallback 
              className={cn(
                'text-xs sm:text-sm font-medium border-2',
                'transition-all duration-200',
                prefersReducedMotion && 'transition-none'
              )}
              style={{ 
                backgroundColor: `${message.userColor}15`, 
                color: message.userColor,
                borderColor: `${message.userColor}30`
              }}
              aria-label={`Avatar for ${message.userName}`}
            >
              {getInitials(message.userName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* Message Content */}
      <div className={cn(
        'flex-1 min-w-0',
        !showAvatar && (isOwnMessage ? 'mr-12 sm:mr-14' : 'ml-12 sm:ml-14')
      )}>
        {/* Header: Name and Time */}
        {showAvatar && (
          <header className={cn(
            'flex items-baseline gap-2 mb-1.5',
            isOwnMessage ? 'flex-row-reverse' : 'flex-row'
          )}>
            <h3 
              className={cn(
                'text-sm sm:text-base font-semibold truncate',
                'max-w-[200px] sm:max-w-[300px]'
              )}
              style={{ color: message.userColor }}
              title={message.userName}
            >
              {message.userName}
            </h3>
            <time 
              className="text-xs text-muted-foreground flex-shrink-0"
              dateTime={new Date(message.timestamp).toISOString()}
              title={timeData.absolute}
            >
              {timeData.relative}
            </time>
          </header>
        )}
        
        {/* Message Bubble */}
        <div className={cn(
          'flex',
          isOwnMessage ? 'justify-end' : 'justify-start'
        )}>
          <div 
            className={cn(
              'relative max-w-[85%] sm:max-w-[80%] lg:max-w-[75%]',
              'px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl',
              'text-sm sm:text-base leading-relaxed',
              'shadow-sm transition-all duration-200',
              'break-words hyphens-auto',
              isOwnMessage 
                ? 'bg-primary text-primary-foreground rounded-br-md' 
                : 'bg-card text-card-foreground border border-border rounded-bl-md',
              prefersReducedMotion && 'transition-none',
              'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
            )}
            role="group"
            aria-label="Message content"
          >
            {/* Message Text */}
            <div className="whitespace-pre-wrap break-words">
              {message.text}
            </div>
            
            {/* Emoji Reactions */}
            {message.emoji && (
              <div className="mt-1 flex items-center gap-1">
                <span 
                  className="text-lg" 
                  role="img" 
                  aria-label="emoji reaction"
                  title={`Emoji: ${message.emoji}`}
                >
                  {message.emoji}
                </span>
              </div>
            )}
            
            {/* Message Status for Own Messages */}
            {isOwnMessage && (
              <div 
                className={cn(
                  'absolute -bottom-5 right-0 text-xs text-muted-foreground',
                  'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                  prefersReducedMotion && 'transition-none'
                )}
                aria-hidden="true"
              >
                Sent
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}