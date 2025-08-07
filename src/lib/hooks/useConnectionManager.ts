'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

interface ConnectionState {
  isConnected: boolean;
  retryCount: number;
  lastConnectionTime: number;
}

export function useConnectionManager() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    retryCount: 0,
    lastConnectionTime: 0
  });
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionRef = useRef<(() => void) | null>(null);
  const maxRetries = 5;
  const baseRetryDelay = 1000; // 1 second

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (connectionRef.current) {
      connectionRef.current();
      connectionRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback((retryCount: number) => {
    if (retryCount >= maxRetries) {
      console.error('❌ Max connection retries reached');
      return;
    }

    const delay = baseRetryDelay * Math.pow(2, retryCount); // Exponential backoff
    console.log(`🔄 Scheduling connection retry ${retryCount + 1}/${maxRetries} in ${delay}ms`);

    retryTimeoutRef.current = setTimeout(() => {
      setConnectionState(prev => ({
        ...prev,
        retryCount: retryCount + 1
      }));
    }, delay);
  }, []);

  const initializeConnection = useCallback(() => {
    if (!database) {
      console.error('❌ Firebase database not initialized');
      return;
    }

    cleanup();

    const connectedRef = ref(database, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const isConnected = snapshot.val() === true;
      const now = Date.now();
      
      setConnectionState(prev => ({
        isConnected,
        retryCount: isConnected ? 0 : prev.retryCount,
        lastConnectionTime: isConnected ? now : prev.lastConnectionTime
      }));

      if (isConnected) {
        console.log('🟢 Firebase connection established');
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
      } else {
        console.log('🔴 Firebase connection lost');
        scheduleRetry(connectionState.retryCount);
      }
    }, (error) => {
      console.error('❌ Connection monitoring error:', error);
      scheduleRetry(connectionState.retryCount);
    });

    connectionRef.current = () => off(connectedRef, 'value', unsubscribe);
  }, [cleanup, scheduleRetry, connectionState.retryCount]);

  useEffect(() => {
    initializeConnection();
    return cleanup;
  }, [initializeConnection, cleanup]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !connectionState.isConnected) {
        console.log('👀 Page visible, checking connection...');
        initializeConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionState.isConnected, initializeConnection]);

  // Handle network changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network online, reinitializing connection...');
      initializeConnection();
    };

    const handleOffline = () => {
      console.log('🚫 Network offline');
      setConnectionState(prev => ({
        ...prev,
        isConnected: false
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initializeConnection]);

  return {
    ...connectionState,
    reinitialize: initializeConnection,
    cleanup
  };
}