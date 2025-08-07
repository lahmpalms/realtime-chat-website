'use client';

import { useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import { User } from '@/lib/types';

export function useUsers() {
  const listenToUsers = useCallback((onUsersUpdate: (users: User[]) => void, onError?: (error: string) => void) => {
    if (!database) {
      if (onError) onError('Firebase not initialized');
      return () => {};
    }
    
    const usersRef = ref(database!, 'chatRoom/users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val();
      if (usersData) {
        const usersList = Object.values(usersData) as User[];
        onUsersUpdate(usersList);
      } else {
        onUsersUpdate([]);
      }
    }, (error) => {
      if (onError) {
        onError(error.message);
      }
    });

    return () => off(usersRef, 'value', unsubscribe);
  }, []);

  const getUserCount = useCallback(async (): Promise<number> => {
    if (!database) {
      return Promise.resolve(0);
    }
    
    return new Promise((resolve, reject) => {
      const usersRef = ref(database!, 'chatRoom/users');
      
      const unsubscribe = onValue(usersRef, (snapshot) => {
        const usersData = snapshot.val();
        const count = usersData ? Object.keys(usersData).length : 0;
        resolve(count);
        off(usersRef, 'value', unsubscribe);
      }, (error) => {
        reject(error);
      });
    });
  }, []);

  const getOnlineUsers = useCallback((users: User[]): User[] => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    return users.filter(user => user.lastSeen > fiveMinutesAgo);
  }, []);

  return {
    listenToUsers,
    getUserCount,
    getOnlineUsers,
  };
}