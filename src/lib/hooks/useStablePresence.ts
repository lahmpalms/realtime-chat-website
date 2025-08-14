'use client';

import { useEffect, useCallback, useRef } from 'react';
import { ref, set, onValue, off, onDisconnect, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User, HEARTBEAT_INTERVAL, DISCONNECT_DEBOUNCE } from '@/lib/types';

export function useStablePresence(currentUser: User | null) {
  const connectedRefCleanup = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserRef = useRef(currentUser);
  const lastConnectedRef = useRef<boolean>(true);
  currentUserRef.current = currentUser;

  const hasOtherActiveTabs = useCallback(() => {
    try {
      const tabId = sessionStorage.getItem('currentTabId');
      const tabs = JSON.parse(localStorage.getItem('chat-tabs') || '[]');
      const u = currentUserRef.current;
      if (!u) return false;
      const now = Date.now();
      return tabs.some((t: any) => t.userId === u.id && t.tabId !== tabId && now - t.timestamp < 30000);
    } catch {
      return false;
    }
  }, []);

  const registerTab = useCallback(() => {
    try {
      let tabId = sessionStorage.getItem('currentTabId');
      if (!tabId) {
        tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem('currentTabId', tabId);
      }
      const u = currentUserRef.current;
      if (!u) return;
      const tabs = JSON.parse(localStorage.getItem('chat-tabs') || '[]');
      const filtered = tabs.filter((t: any) => t.tabId !== tabId);
      filtered.push({ tabId, userId: u.id, userName: u.name, timestamp: Date.now() });
      localStorage.setItem('chat-tabs', JSON.stringify(filtered));
    } catch {
      // ignore
    }
  }, []);

  const updatePresence = useCallback(async (state: 'online' | 'away' | 'offline') => {
    const u = currentUserRef.current;
    if (!database || !u) return;
    const ts = Date.now();
    try {
      await update(ref(database, `chatRoom/presence/${u.id}`), {
        isOnline: state === 'online',
        lastSeen: ts,
        connectionState: state,
        gracePeriodActive: false,
      });
      await update(ref(database, `chatRoom/users/${u.id}`), {
        isOnline: state === 'online',
        lastSeen: ts,
        connectionState: state,
      });
    } catch {
      // ignore
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (!lastConnectedRef.current) return;
      registerTab();
      updatePresence(document.hidden ? 'away' : 'online');
    }, HEARTBEAT_INTERVAL);
  }, [registerTab, updatePresence]);

  const handleVisibilityChange = useCallback(() => {
    if (!lastConnectedRef.current) return;
    updatePresence(document.hidden ? 'away' : 'online');
  }, [updatePresence]);

  const setupConnectionMonitoring = useCallback(() => {
    if (!database) return;
    const connectedRef = ref(database, '.info/connected');
    const unsub = onValue(connectedRef, (snap) => {
      const isConnected = snap.val() === true;
      const was = lastConnectedRef.current;
      lastConnectedRef.current = isConnected;
      if (isConnected && !was) {
        if (disconnectTimeoutRef.current) {
          clearTimeout(disconnectTimeoutRef.current);
          disconnectTimeoutRef.current = null;
        }
        updatePresence('online');
      } else if (!isConnected && was) {
        if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = setTimeout(() => {
          if (!hasOtherActiveTabs()) updatePresence('offline');
        }, DISCONNECT_DEBOUNCE);
      }
    });
    connectedRefCleanup.current = () => off(connectedRef, 'value', unsub);
  }, [updatePresence, hasOtherActiveTabs]);

  const setupOnDisconnect = useCallback(async () => {
    const u = currentUserRef.current;
    if (!database || !u) return;
    try {
      await onDisconnect(ref(database, `chatRoom/typing/${u.id}`)).remove();
      await onDisconnect(ref(database, `chatRoom/presence/${u.id}`)).update({
        connectionState: 'offline',
        gracePeriodActive: true,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    registerTab();
    setupOnDisconnect();
    setupConnectionMonitoring();
    startHeartbeat();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (connectedRefCleanup.current) connectedRefCleanup.current();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, registerTab, setupOnDisconnect, setupConnectionMonitoring, startHeartbeat, handleVisibilityChange]);

  const cleanup = useCallback(async () => {
    const u = currentUserRef.current;
    if (!database || !u) return;
    if (!hasOtherActiveTabs()) {
      try {
        await set(ref(database, `chatRoom/users/${u.id}`), null);
        await set(ref(database, `chatRoom/typing/${u.id}`), null);
        await set(ref(database, `chatRoom/presence/${u.id}`), null);
      } catch {}
    }
  }, [hasOtherActiveTabs]);

  return { cleanup, updatePresenceState: updatePresence, hasOtherActiveTabs };
}