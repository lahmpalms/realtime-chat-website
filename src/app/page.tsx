'use client';

import { useState, useEffect, useRef } from 'react';
import NameInputForm from '@/components/forms/NameInputForm';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { Header } from '@/components/layout/Header';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LayoutWrapper } from '@/contexts/LayoutContext';

import { useChat } from '@/lib/hooks/useChat';
import { useUser } from '@/contexts/UserContext';
import { MAX_USERS } from '@/lib/types';
import { toast } from 'sonner';

// Enhanced toast configuration for better UX
const enhancedToast = {
  success: (message: string, options?: {
    description?: string;
    action?: { label: string; onClick: () => void; altText?: string };
    duration?: number;
  }) => {
    return toast.success(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action && {
        label: options.action.label,
        onClick: options.action.onClick,
      },
    });
  },

  error: (message: string, options?: {
    description?: string;
    action?: { label: string; onClick: () => void; altText?: string };
    duration?: number;
    persistent?: boolean;
  }) => {
    return toast.error(message, {
      description: options?.description,
      duration: options?.persistent ? Infinity : 6000, // Longer for errors
      action: options?.action && {
        label: options.action.label,
        onClick: options.action.onClick,
      },
    });
  },

  loading: (message: string, options?: {
    description?: string;
  }) => {
    return toast.loading(message, {
      description: options?.description,
      duration: Infinity,
    });
  }
};

// Context-aware toast functions
const contextAwareToast = {
  joinSuccess: (name: string) => {
    enhancedToast.success(`Welcome to the chat, ${name}!`, {
      description: "You're now connected and can start messaging with others.",
      duration: 5000, // Longer for important welcome message
    });
  },

  joinError: (retryFn: () => void) => {
    enhancedToast.error("Failed to join chat", {
      description: "Please check your connection and try again.",
      action: {
        label: "Retry",
        onClick: retryFn,
        altText: "Attempt to join chat again"
      },
      duration: 8000, // Longer for errors with actions
    });
  },

  roomFull: () => {
    enhancedToast.error(`Chat room is full`, {
      description: `Maximum ${MAX_USERS} users allowed. Please try again later.`,
      duration: 6000,
    });
  },

  leaveSuccess: () => {
    enhancedToast.success("You left the chat", {
      description: "You can rejoin anytime by entering your name.",
      duration: 3000,
    });
  },

  connectionError: (retryFn: () => void) => {
    enhancedToast.error("Connection lost", {
      description: "Attempting to reconnect automatically...",
      action: {
        label: "Reconnect Now",
        onClick: retryFn,
        altText: "Manually reconnect to chat"
      },
      persistent: true, // Keep until user dismisses or reconnects
    });
  }
};

export default function Home() {
  const { currentUser, hasJoined, joinChat, leaveChat } = useUser();
  const { joinRoom, users, isConnected, error } = useChat();
  const [isJoining, setIsJoining] = useState(false);
  const wasConnectedRef = useRef(false);
  const hasShownConnectionErrorRef = useRef(false);

  const handleJoinChat = async (name: string) => {
    setIsJoining(true);
    
    try {
      const user = await joinRoom(name);
      if (user) {
        joinChat(user);
        contextAwareToast.joinSuccess(name);
      } else {
        // Check if it's a room full error or other error
        if (error && error.includes('full')) {
          contextAwareToast.roomFull();
        } else {
          contextAwareToast.joinError(() => handleJoinChat(name));
        }
      }
    } catch (error) {
      console.error('Join chat error:', error);
      contextAwareToast.joinError(() => handleJoinChat(name));
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveChat = () => {
    leaveChat();
    contextAwareToast.leaveSuccess();
  };

  // Handle connection status changes
  useEffect(() => {
    if (hasJoined) {
      if (isConnected) {
        // Connection established or restored
        wasConnectedRef.current = true;
        hasShownConnectionErrorRef.current = false;
      } else if (wasConnectedRef.current && !hasShownConnectionErrorRef.current) {
        // Connection lost after being connected
        hasShownConnectionErrorRef.current = true;
        contextAwareToast.connectionError(() => {
          window.location.reload();
        });
      }
    }
  }, [isConnected, hasJoined]);

  if (!hasJoined || !currentUser) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <NameInputForm onSubmit={handleJoinChat} isLoading={isJoining} />
      </div>
    );
  }

  return (
    <LayoutWrapper>
      <Header
        userCount={users.length}
        isConnected={isConnected}
        currentUserName={currentUser.name}
        onLeave={handleLeaveChat}
        variant="default"
        showNavigation={true}
      />
      <div className="flex-1 min-h-0">
        <ChatContainer currentUser={currentUser} onLeave={handleLeaveChat} />
      </div>

    </LayoutWrapper>
  );
}
