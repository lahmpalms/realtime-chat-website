"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ConnectionStatus } from "./ConnectionStatus";
import { useChat } from "@/lib/hooks/useChat";
import { useTyping } from "@/lib/hooks/useTyping";
import { User } from "@/lib/types";
import { useStablePresence } from "@/lib/hooks/useStablePresence";
import { toast } from "sonner";
// Removed unused sidebar UI imports
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
  const {
    messages,
    // users,
    typing,
    isConnected,
    isLoading,
    error,
    sendMessage,
    setUserTyping,
    initializeListeners,
    leaveRoom,
  } = useChat();

  const [messageRateLimit, setMessageRateLimit] = useState<number[]>([]);
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const typingHook = useTyping(currentUser.id, currentUser.name);
  const stablePresenceHook = useStablePresence(currentUser);

  // Store current user info in refs to prevent unnecessary re-renders
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Initialize listeners only once
  useEffect(() => {
    const cleanup = initializeListeners();
    return cleanup;
  }, [initializeListeners]);

  // Cleanup on unmount (separate effect)
  useEffect(() => {
    return () => {
      // Cleanup typing and stable presence
      typingHook.cleanup();
      stablePresenceHook.cleanup();
      // Leave room when component unmounts
      leaveRoom(currentUser.id);
    };
  }, [typingHook, stablePresenceHook, leaveRoom, currentUser.id]);

  // Note: Heartbeat is now handled by stablePresenceHook
  // No need for separate heartbeat system

  const handleSendMessage = useCallback(
    async (text: string) => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      const recentMessages = messageRateLimit.filter(
        (timestamp) => timestamp > oneMinuteAgo
      );

      if (recentMessages.length >= 5) {
        toast.error(
          "You are sending messages too quickly. Please wait a moment."
        );
        return;
      }

      try {
        const user = currentUserRef.current;
        await sendMessage(text, user.id, user.name, user.color);
        setMessageRateLimit([...recentMessages, now]);
        typingHook.stopTyping();
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message. Please try again.");
      }
    },
    [messageRateLimit, sendMessage, typingHook]
  ); // Include full typingHook object

  const handleTyping = useCallback(() => {
    typingHook.startTyping();
    const user = currentUserRef.current;
    setUserTyping(user.id, user.name, true);
  }, [typingHook, setUserTyping]); // Include full typingHook object

  const handleStopTyping = useCallback(() => {
    typingHook.stopTyping();
    const user = currentUserRef.current;
    setUserTyping(user.id, user.name, false);
  }, [typingHook, setUserTyping]); // Include full typingHook object

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
            />
          </ResponsiveStatusContainer>
        )}

        {/* Message List */}
        <ResponsiveMessageContainer>
          <MessageList
            messages={messages}
            currentUserId={currentUser.id}
            typing={typing}
          />
        </ResponsiveMessageContainer>

        {/* Message Input */}
        <ResponsiveInputContainer>
          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            onStopTyping={handleStopTyping}
            disabled={!isConnected || isLoading}
          />
        </ResponsiveInputContainer>
      </ResponsiveChatContent>
    </ResponsiveChatWrapper>
  );
}
