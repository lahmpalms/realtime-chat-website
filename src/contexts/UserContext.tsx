'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@/lib/types';

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  hasJoined: boolean;
  joinChat: (user: User) => void;
  leaveChat: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  const joinChat = (user: User) => {
    setCurrentUser(user);
    setHasJoined(true);
    
  };

  const leaveChat = () => {
    setCurrentUser(null);
    setHasJoined(false);
  };

  const contextValue: UserContextType = {
    currentUser,
    setCurrentUser,
    hasJoined,
    joinChat,
    leaveChat,
  };

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