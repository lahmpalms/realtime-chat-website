'use client';

import { useCallback } from 'react';
import { ref, onValue, query, orderByChild, startAfter, limitToLast } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useChat as useChatContext } from '@/contexts/ChatContext';
import { useUser } from '@/contexts/UserContext';
import { SESSION_LEASE_MS, TYPING_TIMEOUT, type User, type TypingStatus } from '@/lib/types';

export function useChat() {
  const { state, setUsers, setTyping, setError, resetState } = useChatContext();
  const session = useUser();
  const { recoverSession } = session;
  const initializeListeners = useCallback(() => {
    if (!database) return () => {};
    setError(null);
    let rawUsers: Record<string, User> = {};
    let offset = 0;
    let previousUsers = '';
    let previousTyping = '';
    const derivePresence = () => {
      const now = Date.now() + offset;
      const users: User[] = [];
      const typing: TypingStatus[] = [];
      for (const user of Object.values(rawUsers)) {
        const active = Object.values(user.connections || {}).filter(connection => connection.lastSeen + SESSION_LEASE_MS > now);
        if (!active.length) continue;
        const isTyping = active.some(connection => connection.isTyping && connection.typingAt + TYPING_TIMEOUT > now);
        users.push({ id: user.id, uid: user.uid, name: user.name, color: user.color,
          joinedAt: user.joinedAt, lastSeen: user.lastSeen, isOnline: true, isTyping,
          connectionState: active.some(connection => connection.state === 'online') ? 'online' : 'away' });
        if (isTyping) typing.push({ userId: user.id, userName: user.name, timestamp: Math.max(...active.filter(connection => connection.isTyping).map(connection => connection.typingAt)) });
      }
      users.sort((a, b) => a.joinedAt - b.joinedAt);
      const userKey = JSON.stringify(users);
      const typingKey = JSON.stringify(typing);
      if (userKey !== previousUsers) { previousUsers = userKey; setUsers(users); }
      if (typingKey !== previousTyping) { previousTyping = typingKey; setTyping(typing); }
    };
    const onError = (error: Error) => { setError(error.message); recoverSession(); };
    const cleanup = [
      onValue(ref(database, '.info/serverTimeOffset'), snapshot => { offset = snapshot.val() || 0; derivePresence(); }),
      onValue(query(ref(database, 'chatRoom/users'), orderByChild('accessUntil'), startAfter(0), limitToLast(20)), snapshot => { rawUsers = snapshot.val() || {}; derivePresence(); }, onError),

    ];
    const timer = setInterval(derivePresence, 1000);
    return () => { cleanup.forEach(stop => stop()); clearInterval(timer); setTyping([]); };
  }, [setUsers, setTyping, setError, recoverSession]);

  return { ...state, currentUser: session.currentUser, isConnected: session.sessionStatus === 'ready',
    resetState, error: session.sessionError || state.error, sendMessage: session.sendMessage, initializeListeners };
}
