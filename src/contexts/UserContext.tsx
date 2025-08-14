'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { User } from '@/lib/types';
import { subscribeAuthState, ensureAnonymousAuth } from '@/lib/auth';
import type { User as FirebaseUser } from 'firebase/auth';

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  hasJoined: boolean;
  joinChat: (user: User) => void;
  leaveChat: () => void;
  authUser: FirebaseUser | null;
  isAuthLoading: boolean;
  authError: string | null;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize anonymous auth on mount and subscribe to auth state changes
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        setIsAuthLoading(true);
        await ensureAnonymousAuth();
        unsubscribe = subscribeAuthState(
          (user) => {
            setAuthUser(user);
            setIsAuthLoading(false);
          },
          (err) => {
            setAuthError(err.message);
            setIsAuthLoading(false);
          }
        );
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : 'Authentication failed');
        setIsAuthLoading(false);
      }
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const joinChat = (user: User) => {
    setCurrentUser(user);
    setHasJoined(true);
    
  };

  const leaveChat = () => {
    setCurrentUser(null);
    setHasJoined(false);
  };

  const contextValue: UserContextType = useMemo(() => ({
    currentUser,
    setCurrentUser,
    hasJoined,
    joinChat,
    leaveChat,
    authUser,
    isAuthLoading,
    authError,
  }), [currentUser, hasJoined, authUser, isAuthLoading, authError]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}