'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { TypingStatus, TYPING_TIMEOUT } from '@/lib/types';

export function useTyping(userId: string, userName: string) {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Store user info in refs to prevent recreation of callbacks
  const userIdRef = useRef(userId);
  const userNameRef = useRef(userName);
  userIdRef.current = userId;
  userNameRef.current = userName;

  const stopTyping = useCallback(async () => {
    if (!database) return;
    
    try {
      setIsTyping(false);
      await set(ref(database!, `chatRoom/typing/${userIdRef.current}`), null);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = undefined;
      }
    } catch (error) {
      console.error('Failed to stop typing:', error);
    }
  }, []); // No dependencies needed since we use refs

  const startTyping = useCallback(async () => {
    if (!database) return;
    
    try {
      setIsTyping(true);
      
      const typingStatus: TypingStatus = {
        userId: userIdRef.current,
        userName: userNameRef.current,
        timestamp: Date.now(),
      };
      
      await set(ref(database!, `chatRoom/typing/${userIdRef.current}`), typingStatus);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, TYPING_TIMEOUT);
    } catch (error) {
      console.error('Failed to start typing:', error);
    }
  }, [stopTyping]); // Only depends on stopTyping which is stable

  const handleInputChange = useCallback(() => {
    startTyping();
  }, [startTyping]);

  const cleanup = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
    if (database) {
      set(ref(database!, `chatRoom/typing/${userIdRef.current}`), null);
    }
  }, []); // No dependencies needed since we use refs

  // Return stable object reference using useMemo
  return useMemo(() => ({
    isTyping,
    startTyping,
    stopTyping,
    handleInputChange,
    cleanup,
  }), [isTyping, startTyping, stopTyping, handleInputChange, cleanup]);
}