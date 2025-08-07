'use client';

import { useEffect, useCallback, useRef } from 'react';
import { ref, get, set, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User, USER_TIMEOUT, CLEANUP_INTERVAL, GRACE_PERIOD } from '@/lib/types';

interface CleanupCandidate {
  userId: string;
  userName: string;
  lastSeen: number;
  gracePeriodStart: number;
  hasOtherTabs: boolean;
}

export function useGracefulCleanup() {
  const cleanupRef = useRef<NodeJS.Timeout | null>(null);
  const candidatesRef = useRef<Map<string, CleanupCandidate>>(new Map());
  const isRunningRef = useRef(false);

  const log = useCallback((message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -5);
    console.log(`[${timestamp}] 🧹 Cleanup | ${message}`, data ? data : '');
  }, []);

  // Check if user has active tabs in localStorage
  const checkUserTabs = useCallback((userId: string): boolean => {
    try {
      const tabs = localStorage.getItem('chat-tabs');
      if (!tabs) return false;
      
      const tabData = JSON.parse(tabs);
      const userTabs = tabData.filter((tab: any) => 
        tab.userId === userId && 
        Date.now() - tab.timestamp < 60000 // Active within 1 minute
      );
      
      return userTabs.length > 0;
    } catch {
      return false;
    }
  }, []);

  // Check if user should be marked as candidate for cleanup
  const evaluateUser = useCallback(async (userId: string, user: User): Promise<CleanupCandidate | null> => {
    if (!database) return null;

    try {
      // Get presence data
      const presenceSnapshot = await get(ref(database, `chatRoom/presence/${userId}`));
      const presenceData = presenceSnapshot.val();
      
      const now = Date.now();
      const lastSeen = presenceData?.lastSeen || user.lastSeen;
      const isGracePeriodActive = presenceData?.gracePeriodActive || false;
      const disconnectTime = presenceData?.disconnectTime;
      
      // Check various conditions
      const timeSinceLastSeen = now - lastSeen;
      const hasOtherTabs = checkUserTabs(userId);
      const isRecentlyDisconnected = disconnectTime && (now - disconnectTime < GRACE_PERIOD);
      
      log(`Evaluating ${user.name}:`, {
        lastSeen: new Date(lastSeen).toISOString(),
        timeSinceLastSeen: `${Math.round(timeSinceLastSeen / 1000)}s`,
        hasOtherTabs,
        gracePeriodActive: isGracePeriodActive,
        recentlyDisconnected: isRecentlyDisconnected
      });

      // Don't clean up if:
      // 1. User has other active tabs
      // 2. Still within grace period after disconnect
      // 3. Recently seen (less than timeout)
      if (hasOtherTabs) {
        log(`✅ ${user.name} - Has active tabs, keeping`);
        return null;
      }
      
      if (isRecentlyDisconnected) {
        log(`⏳ ${user.name} - In grace period, keeping`);
        return null;
      }
      
      if (timeSinceLastSeen < USER_TIMEOUT) {
        log(`✅ ${user.name} - Recently active, keeping`);
        return null;
      }

      // Create cleanup candidate
      return {
        userId,
        userName: user.name,
        lastSeen,
        gracePeriodStart: disconnectTime || now,
        hasOtherTabs
      };
    } catch (error) {
      log(`Error evaluating ${user.name}`, error);
      return null;
    }
  }, [checkUserTabs, log]);

  // Process cleanup candidates with additional verification
  const processCleanupCandidates = useCallback(async (candidates: CleanupCandidate[]) => {
    if (!database || candidates.length === 0) return;

    log(`Processing ${candidates.length} cleanup candidates`);

    for (const candidate of candidates) {
      try {
        // Double-check before removal - user might have reconnected
        const [userSnapshot, presenceSnapshot] = await Promise.all([
          get(ref(database, `chatRoom/users/${candidate.userId}`)),
          get(ref(database, `chatRoom/presence/${candidate.userId}`))
        ]);

        if (!userSnapshot.exists()) {
          log(`${candidate.userName} - Already removed`);
          continue;
        }

        const userData = userSnapshot.val();
        const presenceData = presenceSnapshot.val();
        
        const now = Date.now();
        const currentLastSeen = presenceData?.lastSeen || userData?.lastSeen || 0;
        const timeSinceLastSeen = now - currentLastSeen;
        
        // Final verification - has user activity updated since evaluation?
        if (currentLastSeen > candidate.lastSeen) {
          log(`✅ ${candidate.userName} - Activity detected since evaluation, keeping`);
          continue;
        }

        // Check tabs one more time
        if (checkUserTabs(candidate.userId)) {
          log(`✅ ${candidate.userName} - New tab detected, keeping`);
          continue;
        }

        // Still inactive - proceed with removal
        if (timeSinceLastSeen >= USER_TIMEOUT) {
          const inactiveMinutes = Math.round(timeSinceLastSeen / 60000);
          log(`🗑️ Removing ${candidate.userName} - inactive for ${inactiveMinutes} minutes`);
          
          await Promise.all([
            set(ref(database, `chatRoom/users/${candidate.userId}`), null),
            set(ref(database, `chatRoom/typing/${candidate.userId}`), null),
            set(ref(database, `chatRoom/presence/${candidate.userId}`), null)
          ]);
          
          log(`✅ ${candidate.userName} - Successfully removed`);
        } else {
          log(`⏳ ${candidate.userName} - Grace period not expired yet`);
        }
      } catch (error) {
        log(`❌ Failed to process ${candidate.userName}`, error);
      }
    }
  }, [checkUserTabs, log]);

  // Main cleanup function
  const performCleanup = useCallback(async () => {
    if (!database || isRunningRef.current) {
      log('Cleanup skipped - already running or no database');
      return;
    }

    isRunningRef.current = true;
    log('🧹 Starting graceful cleanup scan...');

    try {
      // Get all users
      const usersSnapshot = await get(ref(database, 'chatRoom/users'));
      const usersData = usersSnapshot.val();

      if (!usersData) {
        log('No users found - cleanup complete');
        return;
      }

      const userEntries = Object.entries(usersData) as [string, User][];
      log(`Scanning ${userEntries.length} users for cleanup candidates`);

      // Evaluate each user
      const candidates: CleanupCandidate[] = [];
      for (const [userId, user] of userEntries) {
        const candidate = await evaluateUser(userId, user);
        if (candidate) {
          candidates.push(candidate);
        }
      }

      log(`Found ${candidates.length} candidates for cleanup`);

      // Process candidates after a brief delay to allow for reconnections
      if (candidates.length > 0) {
        setTimeout(() => {
          processCleanupCandidates(candidates);
        }, 5000); // 5 second delay for final verification
      }

    } catch (error) {
      log('Cleanup scan failed', error);
    } finally {
      isRunningRef.current = false;
      log('🏁 Cleanup scan completed');
    }
  }, [evaluateUser, processCleanupCandidates, log]);

  // Start cleanup interval
  const startCleanup = useCallback(() => {
    if (cleanupRef.current) {
      clearInterval(cleanupRef.current);
    }

    log(`🚀 Starting graceful cleanup system (${CLEANUP_INTERVAL / 60000} minute intervals)`);
    
    cleanupRef.current = setInterval(() => {
      performCleanup();
    }, CLEANUP_INTERVAL);

    // Run initial cleanup after a delay
    setTimeout(() => {
      performCleanup();
    }, 30000); // 30 seconds after start
  }, [performCleanup, log]);

  // Stop cleanup
  const stopCleanup = useCallback(() => {
    log('🛑 Stopping graceful cleanup system');
    
    if (cleanupRef.current) {
      clearInterval(cleanupRef.current);
      cleanupRef.current = null;
    }
    
    candidatesRef.current.clear();
  }, [log]);

  // Initialize cleanup system
  useEffect(() => {
    startCleanup();
    return stopCleanup;
  }, [startCleanup, stopCleanup]);

  // Manual cleanup trigger
  const triggerCleanup = useCallback(() => {
    log('Manual cleanup triggered');
    performCleanup();
  }, [performCleanup, log]);

  return {
    triggerCleanup,
    stopCleanup,
    startCleanup
  };
}