export interface UserConnection {
  joinedAt: number;
  lastSeen: number;
  state: 'online' | 'away';
  isTyping: boolean;
  typingAt: number;
}

export interface User {
  id: string;
  accessUntil?: number;
  connections?: Record<string, UserConnection>;
  uid?: string; // Firebase Auth UID (same as id when using Auth)
  name: string;
  joinedAt: number;
  isTyping: boolean;
  lastSeen: number;
  color: string;
  isOnline?: boolean;
  connectionState?: 'online' | 'offline' | 'away';
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
  emoji?: string;
}

export interface TypingStatus {
  userId: string;
  userName: string;
  timestamp: number;
}

export interface ChatRoom {
  users: Record<string, User>;
  messages: Record<string, Message>;
  metadata: {
    currentUserCount: number;
    maxUsers: number;
    createdAt: number;
  };
}

export interface ChatState {
  currentUser: User | null;
  users: User[];
  messages: Message[];
  hasLoadedMessages: boolean;
  typing: TypingStatus[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export type ChatAction = 
  | { type: 'SET_CURRENT_USER'; payload: User }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_TYPING'; payload: TypingStatus[] }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_NAME_LENGTH = 20;
export const MAX_USERS = 20;
export const TYPING_TIMEOUT = 3000;
export const SESSION_LEASE_MS = 90_000;
export const SESSION_HEARTBEAT_MS = 20_000;
