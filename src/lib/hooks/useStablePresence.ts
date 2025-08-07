'use client';

import { useEffect, useCallback, useRef } from 'react';
import { 
  ref, 
  set, 
  get, 
  update,
  onDisconnect, 
  onValue, 
  off,
  serverTimestamp
} from 'firebase/database';
import { database } from '@/lib/firebase';
import { User, HEARTBEAT_INTERVAL, GRACE_PERIOD, DISCONNECT_DEBOUNCE } from '@/lib/types';

interface PresenceState {
  isOnline: boolean;
  lastSeen: number;
  connectionState: 'online' | 'offline' | 'away';
  disconnectTime?: number; // Track when disconnect started
  gracePeriodActive?: boolean;
}

export function useStablePresence(currentUser: User | null) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionRef = useRef<(() => void) | null>(null);
  const currentUserRef = useRef(currentUser);
  const isSetupRef = useRef(false);
  const lastConnectedRef = useRef(true);
  
  currentUserRef.current = currentUser;

  // Removed debug logging

  // Check if user has other active tabs
  const hasOtherActiveTabs = useCallback(() => {
    try {
      const tabs = localStorage.getItem('chat-tabs');
      if (!tabs) return false;
      
      const tabData = JSON.parse(tabs);
      const user = currentUserRef.current;
      if (!user) return false;
      
      const userTabs = tabData.filter((tab: any) => 
        tab.userId === user.id && 
        tab.tabId !== sessionStorage.getItem('currentTabId') &&
        Date.now() - tab.timestamp < 30000 // Active within 30 seconds
      );
      
      return userTabs.length > 0;
    } catch {
      return false;
    }
  }, []);

  // Register current tab
  const registerTab = useCallback(() => {
    const user = currentUserRef.current;
    if (!user) return;

    try {
      let tabId = sessionStorage.getItem('currentTabId');
      if (!tabId) {
        tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem('currentTabId', tabId);
      }

      const tabs = JSON.parse(localStorage.getItem('chat-tabs') || '[]');
      const updatedTabs = tabs.filter((tab: any) => tab.tabId !== tabId);
      updatedTabs.push({
        tabId,
        userId: user.id,
        userName: user.name,
        timestamp: Date.now()
      });

      localStorage.setItem('chat-tabs', JSON.stringify(updatedTabs));
    } catch (error) {
      // Silently handle tab registration errors
    }
  }, []);

  // Setup graceful onDisconnect that only triggers if no other tabs
  const setupGracefulDisconnect = useCallback(async (user: User) => {
    if (!database) return;

    try {
      const presenceRef = ref(database, `chatRoom/presence/${user.id}`);
      
      // Set up onDisconnect to mark as potentially disconnected, not remove
      await onDisconnect(presenceRef).update({
        connectionState: 'offline',
        disconnectTime: serverTimestamp(),
        gracePeriodActive: true
      });

      // Remove typing on disconnect (this is safe to remove immediately)
      const typingRef = ref(database, `chatRoom/typing/${user.id}`);
      await onDisconnect(typingRef).remove();
    } catch (error) {
      // Silently handle disconnect setup errors
    }
  }, []);

  // Update user presence
  const updatePresence = useCallback(async (state: 'online' | 'away' | 'offline') => {
    const user = currentUserRef.current;
    if (!database || !user) return;

    try {
      const timestamp = Date.now();
      const presenceData: PresenceState = {
        isOnline: state === 'online',
        lastSeen: timestamp,
        connectionState: state,
        gracePeriodActive: false
      };

      // Update presence record completely
      await set(ref(database, `chatRoom/presence/${user.id}`), presenceData);
      
      // Update only specific fields in user record (don't overwrite entire user)
      const userRef = ref(database, `chatRoom/users/${user.id}`);
      await update(userRef, {
        lastSeen: timestamp,
        isOnline: state === 'online',
        connectionState: state
      });
    } catch (error) {
      // Silently handle presence update errors
    }
  }, []);

  // Handle connection state changes with debouncing
  const handleConnectionChange = useCallback((isConnected: boolean) => {
    const wasConnected = lastConnectedRef.current;
    lastConnectedRef.current = isConnected;

    if (isConnected && !wasConnected) {
      // Reconnected - cancel any pending disconnection
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      
      updatePresence('online');
    } else if (!isConnected && wasConnected) {
      // Disconnected - start grace period
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
      }

      disconnectTimeoutRef.current = setTimeout(() => {
        if (!hasOtherActiveTabs()) {
          updatePresence('offline');
        }
      }, DISCONNECT_DEBOUNCE);
    }
  }, [updatePresence, hasOtherActiveTabs, log]);

  // Setup connection monitoring
  const setupConnectionMonitoring = useCallback(() => {
    if (!database) return;

    const connectedRef = ref(database, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const isConnected = snapshot.val() === true;
      handleConnectionChange(isConnected);
    }, (error) => {
      // Silently handle connection monitoring errors
    });

    connectionRef.current = () => off(connectedRef, 'value', unsubscribe);
  }, [handleConnectionChange, log]);

  // Start heartbeat system
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(async () => {
      const user = currentUserRef.current;
      if (!user || !lastConnectedRef.current) return;

      // Update tab registration
      registerTab();

      // Send heartbeat
      try {
        await updatePresence(document.hidden ? 'away' : 'online');
      } catch (error) {
        // Silently handle heartbeat errors
      }
    }, HEARTBEAT_INTERVAL);

  }, [updatePresence, registerTab]);

  // Handle visibility changes
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    
    if (lastConnectedRef.current) {
      updatePresence(isVisible ? 'online' : 'away');
    }
  }, [updatePresence]);

  // Handle before unload with tab check
  const handleBeforeUnload = useCallback(() => {
    // Remove current tab from registration
    try {
      const tabId = sessionStorage.getItem('currentTabId');
      if (tabId) {
        const tabs = JSON.parse(localStorage.getItem('chat-tabs') || '[]');
        const updatedTabs = tabs.filter((tab: any) => tab.tabId !== tabId);
        localStorage.setItem('chat-tabs', JSON.stringify(updatedTabs));
      }
    } catch (error) {
      // Silently handle tab unregistration errors
    }

    // Only set offline if no other tabs will remain
    if (!hasOtherActiveTabs()) {
      updatePresence('offline');
    }
  }, [hasOtherActiveTabs, updatePresence]);

  // Initialize presence system
  const initialize = useCallback(() => {
    const user = currentUserRef.current;
    if (!user || isSetupRef.current) return;

    isSetupRef.current = true;
    registerTab();
    setupGracefulDisconnect(user);
    setupConnectionMonitoring();
    startHeartbeat();
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Set initial online status
    updatePresence('online');

    return () => {
      isSetupRef.current = false;
      
      // Clear timers
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      
      // Remove listeners
      if (connectionRef.current) {
        connectionRef.current();
        connectionRef.current = null;
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    registerTab, 
    setupGracefulDisconnect, 
    setupConnectionMonitoring, 
    startHeartbeat, 
    handleVisibilityChange, 
    handleBeforeUnload, 
    updatePresence
  ]);

  // Manual cleanup function
  const cleanup = useCallback(async () => {
    const user = currentUserRef.current;
    if (!database || !user) return;

    // Only clean up if no other tabs are active
    if (!hasOtherActiveTabs()) {
      try {
        await Promise.all([
          set(ref(database, `chatRoom/users/${user.id}`), null),
          set(ref(database, `chatRoom/typing/${user.id}`), null),
          set(ref(database, `chatRoom/presence/${user.id}`), null)
        ]);
      } catch (error) {
        // Silently handle cleanup errors
      }
    }
  }, [hasOtherActiveTabs]);

  // Effect to initialize/cleanup
  useEffect(() => {
    if (currentUser) {
      const cleanupFn = initialize();
      return cleanupFn;
    }
  }, [currentUser, initialize]);

  return {
    cleanup,
    updatePresence,
    hasOtherActiveTabs
  };
}