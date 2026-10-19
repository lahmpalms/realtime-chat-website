export const SESSION_LEASE_MS = 90_000;
export const MAX_USERS = 20;
export const MAX_CONNECTIONS = 8;
export const MAX_RECENT_DISCONNECTS = 64;
export const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16', '#EC4899', '#6366F1', '#14B8A6'];

export interface Connection {
  joinedAt: number;
  lastSeen: number;
  state: 'online' | 'away';
  isTyping: boolean;
  typingAt: number;
}
export interface Member {
  id: string;
  uid: string;
  name: string;
  color: string;
  joinedAt: number;
  lastSeen: number;
  isTyping: boolean;
  isOnline: boolean;
  connectionState: 'online' | 'offline' | 'away';
  accessUntil: number;
  connections?: Record<string, Connection>;
  retired?: Record<string, number>;
}
export function isLive(connection: Connection | undefined, now = Date.now()): boolean {
  return !!connection && connection.lastSeen + SESSION_LEASE_MS > now;
}
export function reconcile(member: Member, now: number): Member {
  const connections = Object.fromEntries(Object.entries(member.connections || {}).filter(([, connection]) => isLive(connection, now)));
  const active = Object.values(connections);
  const online = active.some(connection => connection.state === 'online');
  return {
    ...member, connections,
    retired: Object.fromEntries(Object.entries(member.retired || {}).filter(([, expiry]) => expiry > now).sort((a, b) => a[1] - b[1]).slice(-(MAX_RECENT_DISCONNECTS + MAX_CONNECTIONS))),
    accessUntil: active.length ? Math.max(...active.map(connection => connection.lastSeen)) + SESSION_LEASE_MS : 0,
    isOnline: !!active.length, connectionState: online ? 'online' : active.length ? 'away' : 'offline',
    isTyping: active.some(connection => connection.isTyping && connection.typingAt + 3000 > now),
    lastSeen: active.length ? Math.max(...active.map(connection => connection.lastSeen)) : member.lastSeen,
  };
}
