'use client';

import { useEffect, useCallback, useRef } from 'react';
import { User } from '@/lib/types';

interface TabInfo {
  tabId: string;
  userId: string;
  userName: string;
  timestamp: number;
  isActive: boolean;
}

export function useMultiTabManager(currentUser: User | null) {
  const tabIdRef = useRef<string>();
  const isMainTabRef = useRef(false);
  const storageListenerRef = useRef<((e: StorageEvent) => void) | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const STORAGE_KEY = 'chat-tabs';
  const MAIN_TAB_KEY = 'chat-main-tab';
  const HEARTBEAT_INTERVAL = 5000; // 5 seconds
  const TAB_TIMEOUT = 15000; // 15 seconds

  // Generate unique tab ID
  const generateTabId = useCallback(() => {
    return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }, []);

  // Get all active tabs from localStorage
  const getActiveTabs = useCallback((): TabInfo[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Update tab info in localStorage
  const updateTabInfo = useCallback((tabInfo: TabInfo) => {
    try {
      const tabs = getActiveTabs();
      const updatedTabs = tabs.filter(tab => tab.tabId !== tabInfo.tabId);
      updatedTabs.push(tabInfo);
      
      // Remove old tabs (timeout)
      const now = Date.now();
      const activeTabs = updatedTabs.filter(tab => now - tab.timestamp < TAB_TIMEOUT);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTabs));
      return activeTabs;
    } catch (error) {
      console.error('Failed to update tab info:', error);
      return [];
    }
  }, [getActiveTabs]);

  // Remove tab from localStorage
  const removeTab = useCallback((tabId: string) => {
    try {
      const tabs = getActiveTabs();
      const updatedTabs = tabs.filter(tab => tab.tabId !== tabId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTabs));
      return updatedTabs;
    } catch (error) {
      console.error('Failed to remove tab:', error);
      return [];
    }
  }, [getActiveTabs]);

  // Check if this is the main tab (first tab with this user)
  const checkMainTab = useCallback((userId: string) => {
    try {
      const mainTabData = localStorage.getItem(MAIN_TAB_KEY);
      const mainTab = mainTabData ? JSON.parse(mainTabData) : null;
      
      const now = Date.now();
      
      // If no main tab or main tab is old, claim main tab status
      if (!mainTab || mainTab.userId !== userId || now - mainTab.timestamp > TAB_TIMEOUT) {
        const newMainTab = {
          tabId: tabIdRef.current,
          userId,
          timestamp: now
        };
        localStorage.setItem(MAIN_TAB_KEY, JSON.stringify(newMainTab));
        return true;
      }
      
      // Check if current tab is the main tab
      return mainTab.tabId === tabIdRef.current;
    } catch {
      return false;
    }
  }, []);

  // Start heartbeat to maintain tab presence
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      if (!currentUser || !tabIdRef.current) return;

      const tabInfo: TabInfo = {
        tabId: tabIdRef.current,
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: Date.now(),
        isActive: !document.hidden
      };

      const activeTabs = updateTabInfo(tabInfo);
      const wasMainTab = isMainTabRef.current;
      isMainTabRef.current = checkMainTab(currentUser.id);

      // Log tab status changes
      if (wasMainTab !== isMainTabRef.current) {
        console.log(`📑 Tab status changed: ${isMainTabRef.current ? 'Main' : 'Secondary'} tab`);
      }

      // Log multiple tabs warning
      const userTabs = activeTabs.filter(tab => tab.userId === currentUser.id);
      if (userTabs.length > 1 && isMainTabRef.current) {
        console.warn(`⚠️ Multiple tabs detected for user ${currentUser.name}: ${userTabs.length} tabs`);
      }
    }, HEARTBEAT_INTERVAL);
  }, [currentUser, updateTabInfo, checkMainTab]);

  // Handle storage events from other tabs
  const handleStorageChange = useCallback((e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === MAIN_TAB_KEY) {
      // Re-check main tab status when storage changes
      if (currentUser) {
        const wasMainTab = isMainTabRef.current;
        isMainTabRef.current = checkMainTab(currentUser.id);
        
        if (wasMainTab !== isMainTabRef.current) {
          console.log(`📑 Tab status updated from storage: ${isMainTabRef.current ? 'Main' : 'Secondary'} tab`);
        }
      }
    }
  }, [currentUser, checkMainTab]);

  // Cleanup on tab close
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up multi-tab manager');
    
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }

    if (storageListenerRef.current) {
      window.removeEventListener('storage', storageListenerRef.current);
      storageListenerRef.current = null;
    }

    // Remove tab from storage
    if (tabIdRef.current) {
      removeTab(tabIdRef.current);
      
      // If this was the main tab, clear main tab status
      if (isMainTabRef.current) {
        try {
          localStorage.removeItem(MAIN_TAB_KEY);
        } catch (error) {
          console.error('Failed to clear main tab status:', error);
        }
      }
    }
  }, [removeTab]);

  // Initialize multi-tab management
  const initialize = useCallback(() => {
    if (!currentUser) return;

    // Generate tab ID
    tabIdRef.current = generateTabId();
    
    console.log(`📑 Initializing multi-tab manager for ${currentUser.name} (Tab: ${tabIdRef.current})`);

    // Check if this is the main tab
    isMainTabRef.current = checkMainTab(currentUser.id);
    console.log(`📑 Tab role: ${isMainTabRef.current ? 'Main' : 'Secondary'}`);

    // Start heartbeat
    startHeartbeat();

    // Listen for storage changes
    storageListenerRef.current = handleStorageChange;
    window.addEventListener('storage', storageListenerRef.current);

    // Schedule cleanup of old tabs
    cleanupTimeoutRef.current = setTimeout(() => {
      const tabs = getActiveTabs();
      const now = Date.now();
      const activeTabs = tabs.filter(tab => now - tab.timestamp < TAB_TIMEOUT);
      
      if (activeTabs.length !== tabs.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTabs));
          console.log(`🧹 Cleaned up ${tabs.length - activeTabs.length} old tab entries`);
        } catch (error) {
          console.error('Failed to cleanup old tabs:', error);
        }
      }
    }, 10000); // Cleanup after 10 seconds

    return cleanup;
  }, [currentUser, generateTabId, checkMainTab, startHeartbeat, handleStorageChange, cleanup, getActiveTabs]);

  // Handle beforeunload event
  const handleBeforeUnload = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (currentUser) {
      const cleanupFn = initialize();
      
      // Add beforeunload listener
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (cleanupFn) cleanupFn();
      };
    }
  }, [currentUser, initialize, handleBeforeUnload]);

  return {
    isMainTab: isMainTabRef.current,
    tabId: tabIdRef.current,
    getActiveTabs,
    cleanup
  };
}