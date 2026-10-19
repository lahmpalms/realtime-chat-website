'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef, useCallback } from 'react';
import type { User, Message } from '@/lib/types';
import { subscribeAuthState, ensureAnonymousAuth } from '@/lib/auth';
import { database, functions } from '@/lib/firebase';
import { ChatSession, SessionSnapshot } from '@/lib/chatSession';
import type { User as FirebaseUser } from 'firebase/auth';

interface UserContextType {
  currentUser: User | null;
  hasJoined: boolean;
  joinChat: (name: string) => Promise<User>;
  leaveChat: () => void;
  sendMessage: (text: string, requestId: string) => Promise<Message>;
  setTyping: (typing: boolean) => void;
  recoverSession: () => void;
  sessionStatus: SessionSnapshot['status'];
  sessionError: string | null;
  authUser: FirebaseUser | null;
  isAuthLoading: boolean;
  authError: string | null;
}
const UserContext = createContext<UserContextType | null>(null);
const INTENT_KEY = 'chat-session';
function saveIntent(user: User | null) {
  try {
    if (user) sessionStorage.setItem(INTENT_KEY, JSON.stringify({
      id: user.id, uid: user.uid, name: user.name, color: user.color,
      joinedAt: user.joinedAt, lastSeen: user.lastSeen, isTyping: false, isOnline: false, connectionState: 'offline',
    }));
    else sessionStorage.removeItem(INTENT_KEY);
  } catch { /* Storage may be blocked. */ }
}
function restoredUser(uid: string): User | null {
  try {
    const user = JSON.parse(sessionStorage.getItem(INTENT_KEY) || 'null');
    return user?.id === uid && typeof user.name === 'string' && typeof user.color === 'string' && typeof user.joinedAt === 'number' ? user : null;
  } catch { return null; }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSnapshot>({ status: 'idle', user: null, error: null });
  const controller = useRef<ChatSession | null>(null);

  const openSession = useCallback((uid: string, name: string) => {
    if (!database || !functions) throw new Error('Firebase not initialized');
    controller.current?.stop();
    const next = new ChatSession(database, functions, uid, name, snapshot => {
      if (controller.current !== next) return;
      setSession(snapshot);
      if (snapshot.status === 'ready' && snapshot.user) {
        setCurrentUser(snapshot.user);
        setHasJoined(true);
        saveIntent(snapshot.user);
      }
    });
    controller.current = next;
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const user = await ensureAnonymousAuth();
        if (!active) return;
        const restored = restoredUser(user.uid);
        if (restored) {
          setCurrentUser(restored);
          setHasJoined(true);
          void openSession(user.uid, restored.name).start().catch(() => {});
        }
        unsubscribe = subscribeAuthState(next => {
          if (!active) return;
          setAuthUser(next);
          setIsAuthLoading(false);
          if (!next || next.uid !== user.uid) {
            controller.current?.stop();
            controller.current = null;
            setCurrentUser(null);
            setHasJoined(false);
            saveIntent(null);
          }
        }, error => { if (active) { setAuthError(error.message); setIsAuthLoading(false); } });
      } catch (error) {
        if (active) { setAuthError(error instanceof Error ? error.message : 'Authentication failed'); setIsAuthLoading(false); }
      }
    })();
    return () => { active = false; unsubscribe?.(); controller.current?.stop(); controller.current = null; };
  }, [openSession]);

  const joinChat = useCallback(async (name: string) => {
    const user = await ensureAnonymousAuth();
    const next = openSession(user.uid, name);
    try { return await next.start(); }
    catch (error) { if (controller.current === next) { next.stop(); controller.current = null; } throw error; }
  }, [openSession]);
  const leaveChat = useCallback(() => {
    controller.current?.stop();
    controller.current = null;
    saveIntent(null);
    setCurrentUser(null);
    setHasJoined(false);
    setSession({ status: 'idle', user: null, error: null });
  }, []);
  const sendMessage = useCallback((text: string, requestId: string) => {
    if (!controller.current) return Promise.reject(new Error('Join the room before sending'));
    return controller.current.send(text, requestId);
  }, []);
  const setTyping = useCallback((typing: boolean) => controller.current?.setTyping(typing), []);
  const recoverSession = useCallback(() => controller.current?.reconnect(), []);
  const value = useMemo(() => ({
    currentUser, hasJoined, joinChat, leaveChat, sendMessage, setTyping, recoverSession,
    sessionStatus: session.status, sessionError: session.error, authUser, isAuthLoading, authError,
  }), [currentUser, hasJoined, joinChat, leaveChat, sendMessage, setTyping, recoverSession, session, authUser, isAuthLoading, authError]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
