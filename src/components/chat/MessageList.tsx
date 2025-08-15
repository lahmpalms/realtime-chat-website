"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";
import { Message, TypingStatus } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/hooks/useResponsive";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  typing: TypingStatus[];
}

export function MessageList({
  messages,
  currentUserId,
  typing,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Performance-optimized scroll behavior
  const scrollToBottom = useCallback(
    (force = false) => {
      if (!messagesEndRef.current || !containerRef.current) return;

      const behavior = prefersReducedMotion ? "auto" : "smooth";

      // Check if user is near bottom before auto-scrolling
      const container = containerRef.current;
      if (!force && container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (!isNearBottom) return; // Don't auto-scroll if user scrolled up
      }

      // Scroll the container to the bottom
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    },
    [prefersReducedMotion]
  );

  // Debounced scroll effect for performance
  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 100);
    return () => clearTimeout(timer);
  }, [messages, typing, scrollToBottom]);

  // Memoized avatar display logic for performance
  const messageDisplayData = useMemo(() => {
    return messages.map((message, index) => {
      const shouldShowAvatar = (() => {
        if (index === 0) return true;

        const previousMessage = messages[index - 1];
        if (!previousMessage) return true;

        return (
          previousMessage.userId !== message.userId ||
          message.timestamp - previousMessage.timestamp > 300000 // 5 minutes
        );
      })();

      const isOwnMessage = message.userId === currentUserId;

      return {
        message,
        shouldShowAvatar,
        isOwnMessage,
        isFirstInGroup: shouldShowAvatar,
        isLastInGroup:
          index === messages.length - 1 ||
          (messages[index + 1] &&
            messages[index + 1].userId !== message.userId),
      };
    });
  }, [messages, currentUserId]);

  // Filter active typing users
  const activeTyping = useMemo(
    () => typing.filter((t) => t.userId !== currentUserId),
    [typing, currentUserId]
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col overflow-hidden"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="flex-1 overflow-y-auto space-y-1 xs:space-y-2 sm:space-y-3 lg:space-y-4 pb-4 px-1 xs:px-2 sm:px-0">
        {messages.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center text-center min-h-[50vh]",
              "text-muted-foreground py-8 xs:py-12 sm:py-16 lg:py-20",
              "space-y-2 xs:space-y-3 sm:space-y-4 px-4"
            )}
            role="status"
            aria-label="No messages in chat"
          >
            <div
              className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl opacity-50 animate-pulse"
              aria-hidden="true"
            >
              💬
            </div>
            <div className="space-y-1 xs:space-y-2 max-w-sm">
              <p className="text-sm xs:text-base sm:text-lg lg:text-xl font-medium">
                No messages yet
              </p>
              <p className="text-xs xs:text-sm sm:text-base text-muted-foreground/80">
                Be the first to say hello!{" "}
                <span className="text-base xs:text-lg animate-bounce inline-block" aria-hidden="true">
                  👋
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div key="messages-container">
            {messageDisplayData.map(
              ({
                message,
                shouldShowAvatar,
                isOwnMessage,
                isFirstInGroup,
                isLastInGroup,
              }) => (
                <div
                  key={message.id}
                  className={cn(
                    "transition-all duration-200 ease-out",
                    prefersReducedMotion && "transition-none",
                    isFirstInGroup && "mt-2 xs:mt-3 sm:mt-4 lg:mt-6 first:mt-0",
                    isLastInGroup && "mb-1 xs:mb-2 sm:mb-3"
                  )}
                  role="article"
                  aria-label={`Message from ${message.userName}`}
                >
                  <MessageItem
                    message={message}
                    isOwnMessage={isOwnMessage}
                    showAvatar={shouldShowAvatar}
                  />
                </div>
              )
            )}
          </div>
        )}

        {activeTyping.length > 0 && (
          <div
            key="typing-indicator"
            className={cn(
              "transition-all duration-300",
              prefersReducedMotion && "transition-none"
            )}
            role="status"
            aria-live="polite"
            aria-label={`${activeTyping.map((t) => t.userName).join(", ")} ${
              activeTyping.length === 1 ? "is" : "are"
            } typing`}
          >
            <TypingIndicator typing={activeTyping} />
          </div>
        )}

        {/* Scroll anchor */}
        <div
          ref={messagesEndRef}
          className="h-1 w-full"
          aria-hidden="true"
          data-testid="messages-end"
        />
      </div>
    </div>
  );
}
