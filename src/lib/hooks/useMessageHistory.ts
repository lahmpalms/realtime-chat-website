'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, query, orderByChild, limitToLast, endBefore, onValue, get, type DataSnapshot } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useChat } from '@/contexts/ChatContext';
import type { Message } from '@/lib/types';

export const MESSAGE_PAGE_SIZE = 50;
export const MAX_VISIBLE_MESSAGES = 200;
const ordered = (messages: Message[]) => messages.sort((a, b) => a.timestamp - b.timestamp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const values = (snapshot: DataSnapshot): Message[] => {
  const messages: Message[] = [];
  snapshot.forEach(child => { messages.push(child.val() as Message); });
  return messages;
};

export function useMessageHistory(connected: boolean, uid: string) {
  const { setMessages, setLoading } = useChat();
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [pendingNew, setPendingNew] = useState(0);
  const [isHistory, setIsHistory] = useState(false);
  const current = useRef({ generation: 0, live: [] as Message[], visible: [] as Message[], history: false, busy: false });
  const publish = useCallback((messages: Message[]) => { current.current.visible = messages; setMessages(messages); }, [setMessages]);

  useEffect(() => {
    if (!connected || !database) return;
    const state = current.current;
    const generation = ++state.generation;
    state.history = false; setIsHistory(false);
    state.busy = false;
    state.live = [];
    setPendingNew(0); setLoadingOlder(false); setHistoryError(''); setLoading(true);
    let first = true;
    const stop = onValue(query(ref(database, 'chatMessages'), orderByChild('timestamp'), limitToLast(MESSAGE_PAGE_SIZE)), snapshot => {
      if (current.current.generation !== generation) return;
      const next = values(snapshot);
      const previousIds = new Set(state.live.map(message => message.id));
      const added = first ? [] : next.filter(message => !previousIds.has(message.id));
      state.live = next;
      if (!state.history || added.some(message => message.userId === uid)) {
        state.history = false; setIsHistory(false);
        publish(next); setPendingNew(0); setHasOlder(next.length === MESSAGE_PAGE_SIZE);
      } else {
        // Keep a bounded, stable window while reading earlier history; catch up explicitly.
        setPendingNew(count => count + added.length);
      }
      first = false;
      setLoading(false);
    }, () => {
      if (current.current.generation !== generation) return;
      setHistoryError('Messages are temporarily unavailable. Reconnect and try again.');
      setLoading(false);
    });
    return () => { state.generation++; state.busy = false; stop(); };
  }, [connected, uid, publish, setLoading]);

  const loadOlder = useCallback(async () => {
    if (!database || !connected || current.current.busy) return;
    const state = current.current;
    const first = state.visible[0];
    if (!first) return;
    const generation = state.generation;
    state.busy = true;
    state.history = true; setIsHistory(true);
    setLoadingOlder(true); setHistoryError('');
    try {
      const snapshot = await get(query(ref(database, 'chatMessages'), orderByChild('timestamp'), endBefore(first.timestamp, first.id), limitToLast(MESSAGE_PAGE_SIZE)));
      if (state.generation !== generation || !state.history) return;
      const older = values(snapshot);
      const merged = new Map([...older, ...state.visible].map(message => [message.id, message]));
      publish(ordered([...merged.values()]).slice(0, MAX_VISIBLE_MESSAGES));
      setHasOlder(older.length === MESSAGE_PAGE_SIZE);
    } catch {
      if (state.generation === generation && state.history) setHistoryError('Couldn’t load earlier messages. Please try again.');
    } finally {
      if (state.generation === generation) { state.busy = false; setLoadingOlder(false); }
    }
  }, [connected, publish]);
  const jumpLatest = useCallback(() => {
    const state = current.current;
    state.history = false; setIsHistory(false);
    publish(state.live);
    setHasOlder(state.live.length === MESSAGE_PAGE_SIZE);
    setPendingNew(0); setHistoryError('');
  }, [publish]);
  return { isHistory, hasOlder, loadingOlder, historyError, pendingNew, loadOlder, jumpLatest };
}
