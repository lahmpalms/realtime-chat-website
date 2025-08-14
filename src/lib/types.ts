export interface User {
  id: string;
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
  typing: Record<string, TypingStatus>;
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

export const USER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
] as const;

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_NAME_LENGTH = 20;
export const MAX_USERS = 20;
export const TYPING_TIMEOUT = 3000;
export const MESSAGE_RATE_LIMIT = 5; // messages per minute

// Presence management constants - More conservative values
export const HEARTBEAT_INTERVAL = 15000; // 15 seconds - more frequent heartbeat
export const USER_TIMEOUT = 900000; // 15 minutes - much longer timeout
export const CLEANUP_INTERVAL = 300000; // 5 minutes - less frequent cleanup
export const CONNECTION_TIMEOUT = 30000; // 30 seconds - longer connection timeout
export const GRACE_PERIOD = 120000; // 2 minutes - grace period before removal
export const DISCONNECT_DEBOUNCE = 10000; // 10 seconds - debounce disconnect events