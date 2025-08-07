'use client';

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import { ChatState, ChatAction, User, Message, TypingStatus } from '@/lib/types';

const initialState: ChatState = {
  currentUser: null,
  users: [],
  messages: [],
  typing: [],
  isConnected: false,
  isLoading: false,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
    
    case 'SET_USERS':
      return { ...state, users: action.payload };
    
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload].sort((a, b) => a.timestamp - b.timestamp)
      };
    
    case 'SET_TYPING':
      return { ...state, typing: action.payload };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  setCurrentUser: (user: User) => void;
  setUsers: (users: User[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setTyping: (typing: TypingStatus[]) => void;
  setConnectionStatus: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const setCurrentUser = useCallback((user: User) => {
    dispatch({ type: 'SET_CURRENT_USER', payload: user });
  }, [dispatch]);

  const setUsers = useCallback((users: User[]) => {
    dispatch({ type: 'SET_USERS', payload: users });
  }, [dispatch]);

  const setMessages = useCallback((messages: Message[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: messages });
  }, [dispatch]);

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, [dispatch]);

  const setTyping = useCallback((typing: TypingStatus[]) => {
    dispatch({ type: 'SET_TYPING', payload: typing });
  }, [dispatch]);

  const setConnectionStatus = useCallback((connected: boolean) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: connected });
  }, [dispatch]);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, [dispatch]);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, [dispatch]);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, [dispatch]);

  const contextValue: ChatContextType = useMemo(() => ({
    state,
    dispatch,
    setCurrentUser,
    setUsers,
    setMessages,
    addMessage,
    setTyping,
    setConnectionStatus,
    setLoading,
    setError,
    resetState,
  }), [state, dispatch, setCurrentUser, setUsers, setMessages, addMessage, setTyping, setConnectionStatus, setLoading, setError, resetState]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}