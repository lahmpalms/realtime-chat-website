'use client';

import { Message } from '@/lib/types';
import { cn } from '@/lib/utils';

export function MessageItem({ message, isOwnMessage, showAvatar = true }: {
  message: Message; isOwnMessage: boolean; showAvatar?: boolean;
}) {
  const date = new Date(message.timestamp);
  const validDate = Number.isFinite(date.getTime());
  const time = validDate ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
  return (
    <article data-message-id={message.id} aria-label={`Message from ${message.userName}`} className={cn('flex gap-2', isOwnMessage && 'flex-row-reverse')}>
      <div aria-hidden="true" className="w-8 shrink-0">
        {showAvatar && <span className="grid h-8 w-8 place-items-center rounded-full border-2 bg-muted text-sm font-semibold"
          style={{ borderColor: message.userColor }}>{Array.from(message.userName)[0]}</span>}
      </div>
      <div className={cn('flex min-w-0 max-w-[calc(100%-2.5rem)] flex-col gap-1', isOwnMessage && 'items-end')}>
        {showAvatar && <div className="flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
          <span dir="auto" className="min-w-0 break-words font-semibold text-foreground [overflow-wrap:anywhere]">{message.userName}{isOwnMessage && <span className="sr-only"> (you)</span>}</span>
          <time dateTime={validDate ? date.toISOString() : undefined} title={validDate ? date.toLocaleString() : undefined} className="text-muted-foreground">{time}</time>
        </div>}
        <p dir="auto" className={cn('max-w-full whitespace-pre-wrap rounded-2xl px-3 py-2 text-base leading-relaxed [overflow-wrap:anywhere]',
          isOwnMessage ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm border bg-muted text-foreground')}>
          {message.text}{message.emoji && <span> {message.emoji}</span>}
        </p>
      </div>
    </article>
  );
}
