"use client";

import { useEffect, useCallback } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ConnectionStatus } from "./ConnectionStatus";
import { useChat } from "@/lib/hooks/useChat";
import { useMessageHistory } from '@/lib/hooks/useMessageHistory';
import { useUser } from "@/contexts/UserContext";
import { User } from "@/lib/types";
import {
  ResponsiveChatWrapper,
  ResponsiveChatContent,
  ResponsiveMessageContainer,
  ResponsiveInputContainer,
  ResponsiveStatusContainer,
} from "./ResponsiveChatWrapper";

interface ChatContainerProps {
  currentUser: User;
  onLeave?: () => void;
}

export function ChatContainer({ currentUser }: ChatContainerProps) {
  const { messages, hasLoadedMessages, typing, isConnected, isLoading, error, sendMessage, initializeListeners } = useChat();
  const history = useMessageHistory(isConnected, currentUser.id);
  const { setTyping, recoverSession } = useUser();
  useEffect(() => {
    if (isConnected) return initializeListeners();
  }, [isConnected, initializeListeners]);
  const handleTyping = useCallback(() => setTyping(true), [setTyping]);
  const handleStopTyping = useCallback(() => setTyping(false), [setTyping]);

  return (
    <ResponsiveChatWrapper>
      <ResponsiveChatContent>
        {/* Connection Status */}
        {(!isConnected || isLoading || error) && (
          <ResponsiveStatusContainer>
            <ConnectionStatus
              isConnected={isConnected}
              isLoading={isLoading}
              error={error}
              onRetry={recoverSession}
            />
          </ResponsiveStatusContainer>
        )}

        {/* Message List */}
        <ResponsiveMessageContainer>
          <MessageList
            messages={messages}
            currentUserId={currentUser.id}
            typing={typing}
            isLoading={!hasLoadedMessages}
            history={history}
          />
        </ResponsiveMessageContainer>

        {/* Message Input */}
        <ResponsiveInputContainer>
          <MessageInput
            key={currentUser.id}
            onSendMessage={sendMessage}
            userId={currentUser.id}
            onTyping={handleTyping}
            onStopTyping={handleStopTyping}
            disabled={!isConnected || isLoading}
          />
        </ResponsiveInputContainer>
      </ResponsiveChatContent>
    </ResponsiveChatWrapper>
  );
}
