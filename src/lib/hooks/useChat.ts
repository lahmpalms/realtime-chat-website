'use client';

import { useEffect, useCallback, useRef } from 'react';
import { ref, set, onValue, off, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useChat as useChatContext } from '@/contexts/ChatContext';
import { User, Message, TypingStatus, USER_COLORS, USER_TIMEOUT, GRACE_PERIOD } from '@/lib/types';

export function useChat() {
  const context = useChatContext();
  const {
    state,
    setUsers,
    setMessages,
    setTyping,
    setConnectionStatus,
    setError,
    setLoading
  } = context;

  // Removed dispatchRef - using stable dispatch functions instead

  const messageListenersRef = useRef<Set<() => void>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const generateUserId = useCallback(() => {
    // Generate a safe user ID with only alphanumeric characters
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).replace('0.', '').slice(0, 8);
    const userId = `user_${timestamp}_${randomPart}`;
    return userId;
  }, []);

  const getRandomColor = useCallback(() => {
    return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  }, []);

  const joinRoom = useCallback(async (userName: string): Promise<User | null> => {
    // Sanitize user name to prevent Firebase path issues
    const sanitizedUserName = userName.trim().slice(0, 20);
    if (!sanitizedUserName) {
      setError('Invalid username');
      return null;
    }
    
    if (!database) {
      setError('Firebase not initialized');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Check current user count before joining
      const usersPath = 'chatRoom/users';
      const usersRef = ref(database!, usersPath);
      const usersSnapshot = await get(usersRef);
      const userData = usersSnapshot.val();
      const currentUsers = userData ? Object.values(userData) as User[] : [];
      
      if (currentUsers.length >= 20) {
        setError('Chat room is full (maximum 20 users)');
        setLoading(false);
        return null;
      }

      const userId = generateUserId();
      const userColor = getRandomColor();
      const timestamp = Date.now();
      
      const user: User = {
        id: userId,
        name: sanitizedUserName,
        joinedAt: timestamp,
        isTyping: false,
        lastSeen: timestamp,
        color: userColor,
        isOnline: true,
        connectionState: 'online'
      };

      // Save user data
      const userPath = `chatRoom/users/${userId}`;
      const userRef = ref(database!, userPath);
      
      // Force complete user data save (overwrites any corrupted partial data)
      await set(userRef, user);
      
      // Verify the complete user object was saved
      const savedUserSnapshot = await get(userRef);
      const savedUser = savedUserSnapshot.val();
      
      if (!savedUser?.name || !savedUser?.id) {
        await set(userRef, user); // Retry once
      }
      
      // Initialize presence data with basic cleanup
      const presencePath = `chatRoom/presence/${userId}`;
      const presenceRef = ref(database!, presencePath);
      
      const presenceData = {
        isOnline: true,
        lastSeen: timestamp,
        connectionState: 'online',
        gracePeriodActive: false
      };
      
      await set(presenceRef, presenceData);
      
      // Set up basic onDisconnect handlers for cleanup
      const { onDisconnect } = await import('firebase/database');
      
      // Remove user completely on disconnect (simpler approach)
      await onDisconnect(userRef).remove();
      await onDisconnect(presenceRef).remove();
      await onDisconnect(ref(database!, `chatRoom/typing/${userId}`)).remove();
      
      setLoading(false);
      return user;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to join room');
      setLoading(false);
      return null;
    }
  }, [generateUserId, getRandomColor, setError, setLoading]);

  const leaveRoom = useCallback(async (userId: string) => {
    if (!database) return;
    
    try {
      // Remove from all locations including presence
      await Promise.all([
        set(ref(database!, `chatRoom/users/${userId}`), null),
        set(ref(database!, `chatRoom/typing/${userId}`), null),
        set(ref(database!, `chatRoom/presence/${userId}`), null)
      ]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to leave room');
    }
  }, [setError]);

  const updateLastSeen = useCallback(async (userId: string) => {
    if (!database) return;
    
    try {
      const timestamp = Date.now();
      
      // Update both user and presence lastSeen
      await Promise.all([
        set(ref(database!, `chatRoom/users/${userId}/lastSeen`), timestamp),
        set(ref(database!, `chatRoom/presence/${userId}/lastSeen`), timestamp),
        set(ref(database!, `chatRoom/users/${userId}/isOnline`), true),
        set(ref(database!, `chatRoom/presence/${userId}/isOnline`), true)
      ]);
    } catch (error) {
      console.error('Failed to update lastSeen:', error);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, userId: string, userName: string, userColor: string) => {
    if (!database) {
      setError('Firebase not initialized');
      return;
    }
    
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const message: Message = {
        id: messageId,
        userId,
        userName,
        userColor,
        text: text.trim(),
        timestamp: Date.now(),
      };

      await set(ref(database!, `chatRoom/messages/${messageId}`), message);
      await updateLastSeen(userId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }, [updateLastSeen, setError]);

  const setUserTyping = useCallback(async (userId: string, userName: string, isTyping: boolean) => {
    if (!database) return;
    
    try {
      if (isTyping) {
        const typingStatus: TypingStatus = {
          userId,
          userName,
          timestamp: Date.now(),
        };
        await set(ref(database!, `chatRoom/typing/${userId}`), typingStatus);
        await updateLastSeen(userId);
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(async () => {
          if (database) {
            await set(ref(database!, `chatRoom/typing/${userId}`), null);
          }
        }, 3000);
      } else {
        await set(ref(database!, `chatRoom/typing/${userId}`), null);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    } catch (error) {
      console.error('Failed to set typing status:', error);
    }
  }, [updateLastSeen]);

  const initializeListeners = useCallback(() => {
    if (!database) {
      return () => {};
    }

    const cleanupFunctions: (() => void)[] = [];

    // Users listener
    const usersRef = ref(database!, 'chatRoom/users');
    
    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val();
      
      // Process user data immediately for real-time updates
      if (usersData) {
        const usersList = Object.values(usersData) as User[];
        
        // Filter out incomplete user objects and auto-cleanup
        const completeUsers = usersList.filter(user => {
          const isComplete = user && 
            user.id && 
            user.name && 
            typeof user.name === 'string' && 
            user.color;
          
          if (!isComplete) {
            // Auto-cleanup incomplete user entries
            const incompleteUserId = Object.keys(usersData).find(id => usersData[id] === user);
            if (incompleteUserId) {
              set(ref(database!, `chatRoom/users/${incompleteUserId}`), null).catch(() => {});
            }
          }
          
          return isComplete;
        });
        
        // Sort users by join time for consistent ordering
        const sortedUsers = completeUsers.sort((a, b) => a.joinedAt - b.joinedAt);
        setUsers(sortedUsers);
      } else {
        setUsers([]);
      }
      setConnectionStatus(true);
    }, (error) => {
      setError(error.message);
      setConnectionStatus(false);
    });

    cleanupFunctions.push(() => off(usersRef, 'value', usersUnsubscribe));

    // Messages listener
    const messagesRef = ref(database!, 'chatRoom/messages');
    const messagesUnsubscribe = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        const messagesList = Object.values(messagesData) as Message[];
        const sortedMessages = messagesList.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(sortedMessages.slice(-100));
      } else {
        setMessages([]);
      }
    }, (error) => {
      setError(error.message);
    });

    cleanupFunctions.push(() => off(messagesRef, 'value', messagesUnsubscribe));

    // Typing listener
    const typingRef = ref(database!, 'chatRoom/typing');
    const typingUnsubscribe = onValue(typingRef, (snapshot) => {
      const typingData = snapshot.val();
      if (typingData) {
        const typingList = Object.values(typingData) as TypingStatus[];
        const activeTyping = typingList.filter(
          typing => Date.now() - typing.timestamp < 3000
        );
        setTyping(activeTyping);
      } else {
        setTyping([]);
      }
    });

    cleanupFunctions.push(() => off(typingRef, 'value', typingUnsubscribe));

    // Conservative cleanup - only runs if graceful cleanup fails
    // This serves as a backup and runs much less frequently
    const conservativeCleanup = setInterval(async () => {
      if (!database) return;
      
      try {
        const [usersSnapshot, presenceSnapshot] = await Promise.all([
          get(usersRef),
          get(ref(database!, 'chatRoom/presence'))
        ]);
        
        const usersData = usersSnapshot.val();
        const presenceData = presenceSnapshot.val();
        
        if (usersData) {
          const now = Date.now();
          // Much longer timeout - only clean up really old entries
          const extremeTimeoutThreshold = now - (USER_TIMEOUT * 2); // 30 minutes
          
          const userEntries = Object.entries(usersData) as [string, User][];
          
          for (const [userId, user] of userEntries) {
            const presenceInfo = presenceData?.[userId];
            const lastSeen = presenceInfo?.lastSeen || user.lastSeen;
            const gracePeriodStart = presenceInfo?.disconnectTime;
            
            // Only clean up if:
            // 1. Extremely old (30+ minutes)
            // 2. Grace period has long expired
            const isExtremelyOld = lastSeen < extremeTimeoutThreshold;
            const gracePeriodExpired = !gracePeriodStart || (now - gracePeriodStart > GRACE_PERIOD * 2);
            
            if (isExtremelyOld && gracePeriodExpired) {
              // Remove from all locations
              await Promise.all([
                set(ref(database!, `chatRoom/users/${userId}`), null),
                set(ref(database!, `chatRoom/typing/${userId}`), null),
                set(ref(database!, `chatRoom/presence/${userId}`), null)
              ]);
            }
          }
        }
      } catch {
        // Silently handle cleanup errors
      }
    }, 10 * 60 * 1000); // Run every 10 minutes, much less frequently

    cleanupFunctions.push(() => clearInterval(conservativeCleanup));

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [setUsers, setConnectionStatus, setError, setMessages, setTyping]); // Include stable dispatch functions

  useEffect(() => {
    const listeners = messageListenersRef.current;
    return () => {
      listeners.forEach(cleanup => cleanup());
      listeners.clear();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    joinRoom,
    leaveRoom,
    sendMessage,
    setUserTyping,
    updateLastSeen,
    initializeListeners,
  };
}