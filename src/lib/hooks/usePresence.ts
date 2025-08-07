'use client';

import { useEffect, useCallback, useRef } from 'react';
import { 
  ref, 
  set, 
  get, 
  onDisconnect, 
  onValue, 
  off,
  serverTimestamp,
  goOffline,
  goOnline
} from 'firebase/database';
import { database } from '@/lib/firebase';
import { User, HEARTBEAT_INTERVAL, USER_TIMEOUT, CLEANUP_INTERVAL } from '@/lib/types';

interface PresenceState {
  isOnline: boolean;
  lastSeen: number;
  connectionState: 'online' | 'offline' | 'away';
}

export function usePresence(currentUser: User | null) {
  const presenceRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<NodeJS.Timeout | null>(null);
  const connectionRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Monitor Firebase connection state
  const setupConnectionMonitoring = useCallback(() => {
    if (!database || !currentUser) return;

    const connectedRef = ref(database, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const isConnected = snapshot.val() === true;
      const user = currentUserRef.current;
      
      if (!user) return;

      if (isConnected) {
        console.log('🟢 Firebase connected - setting up presence');
        setupUserPresence(user);
      } else {
        console.log('🔴 Firebase disconnected');
        // Don't manually clean up here - let onDisconnect handle it
      }
    });

    connectionRef.current = () => off(connectedRef, 'value', unsubscribe);
  }, [currentUser]);

  // Setup user presence with onDisconnect handlers
  const setupUserPresence = useCallback(async (user: User) => {
    if (!database) return;

    try {
      const userRef = ref(database, `chatRoom/users/${user.id}`);
      const typingRef = ref(database, `chatRoom/typing/${user.id}`);
      const presenceStateRef = ref(database, `chatRoom/presence/${user.id}`);

      // Set up onDisconnect handlers first (before setting online status)
      await onDisconnect(userRef).remove();
      await onDisconnect(typingRef).remove();
      await onDisconnect(presenceStateRef).remove();

      // Set user as online with current timestamp
      const presenceData: PresenceState = {
        isOnline: true,
        lastSeen: Date.now(),
        connectionState: 'online'
      };

      await set(presenceStateRef, presenceData);
      
      // Update user's lastSeen
      await set(ref(database, `chatRoom/users/${user.id}/lastSeen`), Date.now());
      await set(ref(database, `chatRoom/users/${user.id}/isOnline`), true);

      console.log('✅ User presence setup complete for:', user.name);
    } catch (error) {
      console.error('❌ Failed to setup user presence:', error);
    }
  }, []);

  // Heartbeat to maintain presence
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(async () => {
      const user = currentUserRef.current;
      if (!database || !user) return;

      try {
        const timestamp = Date.now();
        
        // Update presence timestamp
        await set(ref(database, `chatRoom/presence/${user.id}/lastSeen`), timestamp);
        await set(ref(database, `chatRoom/users/${user.id}/lastSeen`), timestamp);
        
        console.log('💓 Heartbeat sent for:', user.name);
      } catch (error) {
        console.error('💔 Heartbeat failed:', error);
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Background cleanup of inactive users
  const startBackgroundCleanup = useCallback(() => {
    if (cleanupRef.current) {
      clearInterval(cleanupRef.current);
    }

    cleanupRef.current = setInterval(async () => {
      if (!database) return;

      try {
        const usersRef = ref(database, 'chatRoom/users');
        const presenceRef = ref(database, 'chatRoom/presence');
        
        const [usersSnapshot, presenceSnapshot] = await Promise.all([
          get(usersRef),
          get(presenceRef)
        ]);

        const usersData = usersSnapshot.val();
        const presenceData = presenceSnapshot.val();
        
        if (!usersData) return;

        const now = Date.now();
        const timeoutThreshold = now - USER_TIMEOUT;
        
        const userEntries = Object.entries(usersData) as [string, User][];
        let cleanedCount = 0;

        for (const [userId, user] of userEntries) {
          const presenceInfo = presenceData?.[userId] as PresenceState;
          const lastSeen = presenceInfo?.lastSeen || user.lastSeen;
          
          if (lastSeen < timeoutThreshold) {
            console.log(`🧹 Cleaning up inactive user: ${user.name} (last seen: ${new Date(lastSeen).toLocaleString()})`);
            
            // Remove from all locations
            await Promise.all([
              set(ref(database, `chatRoom/users/${userId}`), null),
              set(ref(database, `chatRoom/typing/${userId}`), null),
              set(ref(database, `chatRoom/presence/${userId}`), null)
            ]);
            
            cleanedCount++;
          }
        }

        if (cleanedCount > 0) {
          console.log(`🧽 Background cleanup completed: ${cleanedCount} inactive users removed`);
        }
      } catch (error) {
        console.error('❌ Background cleanup failed:', error);
      }
    }, CLEANUP_INTERVAL);
  }, []);

  // Handle visibility change (tab switching, minimizing)
  const handleVisibilityChange = useCallback(() => {
    const user = currentUserRef.current;
    if (!database || !user) return;

    const isVisible = !document.hidden;
    
    try {
      if (isVisible) {
        // Tab became visible - set as online
        set(ref(database, `chatRoom/presence/${user.id}/connectionState`), 'online');
        set(ref(database, `chatRoom/users/${user.id}/isOnline`), true);
        console.log('👀 Tab visible - user online');
      } else {
        // Tab hidden - set as away
        set(ref(database, `chatRoom/presence/${user.id}/connectionState`), 'away');
        console.log('🙈 Tab hidden - user away');
      }
    } catch (error) {
      console.error('Failed to handle visibility change:', error);
    }
  }, []);

  // Handle beforeunload (browser closing)
  const handleBeforeUnload = useCallback(() => {
    const user = currentUserRef.current;
    if (!database || !user) return;

    try {
      // Try to clean up immediately (may not work due to browser limitations)
      set(ref(database, `chatRoom/presence/${user.id}/connectionState`), 'offline');
      
      // Force offline to trigger onDisconnect handlers
      goOffline();
      
      console.log('🚪 Browser closing - triggering cleanup');
    } catch (error) {
      console.error('Failed to handle before unload:', error);
    }
  }, []);

  // Initialize presence system
  const initializePresence = useCallback(() => {
    if (!currentUser || isInitializedRef.current) return;

    console.log('🚀 Initializing presence system for:', currentUser.name);
    
    setupConnectionMonitoring();
    startHeartbeat();
    startBackgroundCleanup();
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    isInitializedRef.current = true;
    
    return () => {
      console.log('🧹 Cleaning up presence system');
      
      // Clear intervals
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      
      if (cleanupRef.current) {
        clearInterval(cleanupRef.current);
        cleanupRef.current = null;
      }
      
      // Remove listeners
      if (connectionRef.current) {
        connectionRef.current();
        connectionRef.current = null;
      }
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      isInitializedRef.current = false;
    };
  }, [currentUser, setupConnectionMonitoring, startHeartbeat, startBackgroundCleanup, handleVisibilityChange, handleBeforeUnload]);

  // Manual cleanup function
  const cleanup = useCallback(async () => {
    const user = currentUserRef.current;
    if (!database || !user) return;

    try {
      console.log('🧹 Manual presence cleanup for:', user.name);
      
      // Remove user data
      await Promise.all([
        set(ref(database, `chatRoom/users/${user.id}`), null),
        set(ref(database, `chatRoom/typing/${user.id}`), null),
        set(ref(database, `chatRoom/presence/${user.id}`), null)
      ]);
      
      console.log('✅ Manual cleanup completed');
    } catch (error) {
      console.error('❌ Manual cleanup failed:', error);
    }
  }, []);

  // Update presence state
  const updatePresenceState = useCallback(async (state: 'online' | 'offline' | 'away') => {
    const user = currentUserRef.current;
    if (!database || !user) return;

    try {
      await set(ref(database, `chatRoom/presence/${user.id}/connectionState`), state);
      await set(ref(database, `chatRoom/users/${user.id}/isOnline`), state === 'online');
      
      if (state === 'online') {
        await set(ref(database, `chatRoom/presence/${user.id}/lastSeen`), Date.now());
      }
    } catch (error) {
      console.error('Failed to update presence state:', error);
    }
  }, []);

  // Effect to initialize/cleanup presence
  useEffect(() => {
    if (currentUser) {
      const cleanup = initializePresence();
      return cleanup;
    }
  }, [currentUser, initializePresence]);

  return {
    cleanup,
    updatePresenceState,
    setupUserPresence
  };
}