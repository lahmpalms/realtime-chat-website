'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { Message, TypingStatus } from '@/lib/types';
import { usePrefersReducedMotion } from '@/lib/hooks/useResponsive';

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  typing: TypingStatus[];
  isLoading?: boolean;
  history?: { isHistory: boolean; hasOlder: boolean; loadingOlder: boolean; historyError: string; pendingNew: number; loadOlder: () => Promise<void>; jumpLatest: () => void };
}

export function MessageList({ messages, currentUserId, typing, isLoading = false, history }: MessageListProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const observedSize = useRef({ width: 0, height: 0, scrollHeight: 0 });
  const prependAnchor = useRef<{ id: string; top: number } | null>(null);
  const previous = useRef<Set<string> | null>(null);
  const [unread, setUnread] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const reducedMotion = usePrefersReducedMotion();
  const bottom = useCallback((smooth = false) => {
    const element = viewport.current;
    if (!element) return;
    observedSize.current = { width: element.clientWidth, height: element.clientHeight, scrollHeight: element.scrollHeight };
    nearBottom.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' });
    setUnread(0);
  }, [reducedMotion]);

  // Decide using the position BEFORE the new messages changed scrollHeight.
  useLayoutEffect(() => {
    if (isLoading) return;
    const element = viewport.current;
    const before = observedSize.current;
    // Scroll events may arrive on the next animation frame. Read the old content height as well.
    if (element && before.scrollHeight && element.clientWidth === before.width && element.clientHeight === before.height) {
      nearBottom.current = before.scrollHeight - element.scrollTop - before.height < 64;
    }
    const anchor = prependAnchor.current;
    const anchorElement = anchor && element ? Array.from(element.querySelectorAll<HTMLElement>('[data-message-id]')).find(node => node.dataset.messageId === anchor.id) : null;
    const paginating = !!anchor;
    if (element && anchorElement) {
      element.scrollTop += anchorElement.getBoundingClientRect().top - anchor!.top;
      nearBottom.current = false;
    }
    if (!history?.loadingOlder) prependAnchor.current = null;
    const added = previous.current ? messages.filter(message => !previous.current!.has(message.id)) : [];
    const incoming = added.filter(message => message.userId !== currentUserId);
    const firstLoad = previous.current === null;
    previous.current = new Set([...(previous.current || []), ...messages.map(message => message.id)].slice(-2000));
    if (!paginating && (firstLoad || nearBottom.current || added.some(message => message.userId === currentUserId))) bottom();
    else if (!paginating && incoming.length) setUnread(count => count + incoming.length);
    if (element) observedSize.current = { width: element.clientWidth, height: element.clientHeight, scrollHeight: element.scrollHeight };
    if (!paginating && incoming.length) {
      const last = incoming[incoming.length - 1];
      setAnnouncement(`${incoming.length > 1 ? `${incoming.length} new messages. ` : ''}${last.userName}: ${last.text.slice(0, 160)}`);
    }
  }, [messages, currentUserId, isLoading, bottom, history?.loadingOlder]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const element = viewport.current;
      if (!element) return;
      const before = observedSize.current;
      if (before.scrollHeight && element.clientWidth === before.width && element.clientHeight === before.height) {
        nearBottom.current = before.scrollHeight - element.scrollTop - before.height < 64;
      }
      observedSize.current = { width: element.clientWidth, height: element.clientHeight, scrollHeight: element.scrollHeight };
      if (nearBottom.current) bottom();
    });
    if (viewport.current) observer.observe(viewport.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [bottom]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={viewport} role="log" aria-label="Chat messages" aria-live="off" aria-busy={isLoading}
        tabIndex={0} className="h-full overflow-y-auto overscroll-contain p-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-5"
        onScroll={() => {
          const element = viewport.current!;
          // A viewport resize can emit a scroll event before ResizeObserver. Keep the prior anchor decision.
          if (element.clientHeight !== observedSize.current.height || element.clientWidth !== observedSize.current.width) return;
          nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
          if (nearBottom.current) setUnread(0);
        }}>
        <div ref={content} className="space-y-3">
          {history?.hasOlder && <Button type="button" variant="outline" className="h-11" disabled={history.loadingOlder} onClick={() => {
            const first = viewport.current?.querySelector<HTMLElement>('[data-message-id]');
            if (first) prependAnchor.current = { id: first.dataset.messageId!, top: first.getBoundingClientRect().top };
            void history.loadOlder();
          }}>{history.loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}</Button>}
          {history?.isHistory && <Button type="button" variant="outline" className="ml-2 h-11" onClick={() => { history.jumpLatest(); bottom(); viewport.current?.focus({ preventScroll: true }); }}>Return to latest</Button>}
          {history?.historyError && <p role="alert" className="text-sm text-destructive">{history.historyError}</p>}
          {!messages.length && <div className="grid min-h-40 place-content-center gap-2 py-8 text-center">
            <p className="text-base font-medium">{isLoading ? 'Loading messages…' : 'No messages yet'}</p>
            <p className="text-sm text-muted-foreground">{isLoading ? 'Your conversation will appear here.' : 'Say hello to the room 👋'}</p>
          </div>}
          {messages.map((message, index) => <MessageItem key={message.id} message={message}
            isOwnMessage={message.userId === currentUserId}
            showAvatar={index === 0 || messages[index - 1].userId !== message.userId || message.timestamp - messages[index - 1].timestamp > 300_000} />)}
          <TypingIndicator typing={typing.filter(person => person.userId !== currentUserId)} />
        </div>
      </div>
      {(unread > 0 || (history?.pendingNew || 0) > 0) && <Button type="button" className="absolute bottom-3 left-1/2 h-11 max-w-[95%] -translate-x-1/2 shadow-lg"
        onClick={() => { if (history?.isHistory) history.jumpLatest(); bottom(true); viewport.current?.focus({ preventScroll: true }); }}><ArrowDown aria-hidden="true" className="h-4 w-4" />{unread + (history?.pendingNew || 0)} new · Jump to latest</Button>}
      <p className="sr-only" role="status" aria-atomic="true">{announcement}</p>
    </div>
  );
}
