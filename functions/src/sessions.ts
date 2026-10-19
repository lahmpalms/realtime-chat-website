import { controlTransaction } from './utils/controlTransaction';
import * as functions from 'firebase-functions/v1';
import { randomInt } from 'node:crypto';
import { Member, reconcile, isLive, MAX_USERS, MAX_CONNECTIONS, MAX_RECENT_DISCONNECTS, COLORS } from './sessionState';
export { Member, reconcile, isLive, SESSION_LEASE_MS } from './sessionState';
import { assertAuthedContext } from './utils/auth';
import { pruneUsers, MAX_STORED_PROFILES } from './retention';
import { callable, runtime } from './observability';

export function payload(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid request fields');
  }
  return value as Record<string, unknown>;
}
export function assertConnectionId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(value) ||
      Object.prototype.hasOwnProperty.call(Object.prototype, value)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid connection ID');
  }
}
export const joinRoom = callable('joinRoom', async (data: unknown, context) => {
  const uid = assertAuthedContext(context);
  const { name, connectionId } = payload(data, ['name', 'connectionId']);
  assertConnectionId(connectionId);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 20 ||
      Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new functions.https.HttpsError('invalid-argument', 'Name must contain 1–20 printable characters');
  }
  const initial: Member = {
    id: uid, uid, name: name.trim(), color: COLORS[randomInt(COLORS.length)],
    joinedAt: Date.now(), lastSeen: Date.now(), isTyping: false, isOnline: true,
    connectionState: 'online', accessUntil: 0,
  };
  const result = await controlTransaction('chatRoom/users', (current: Record<string, Member> | null) => {
    const now = Date.now();
    const users = pruneUsers(current || {}, now, uid);
    if (!users[uid] && Object.keys(users).length >= MAX_STORED_PROFILES) return users;
    let member = Object.prototype.hasOwnProperty.call(users, uid) ? users[uid] : initial;
    const connections = member.connections || {};
    if (!Object.keys(connections).length) member = { ...member, name: name.trim() };
    const activeMembers = Object.values(users).filter(user => user.accessUntil > now).length;
    if (member.retired?.[connectionId] && member.retired[connectionId] > now) return users;
    if (!connections[connectionId] && Object.keys(member.retired || {}).length >= MAX_RECENT_DISCONNECTS) return users;
    if ((!Object.keys(connections).length && activeMembers >= MAX_USERS) ||
        (!connections[connectionId] && Object.keys(connections).length >= MAX_CONNECTIONS)) return users;
    const previous = connections[connectionId];
    users[uid] = reconcile({
      ...member,
      connections: { ...connections, [connectionId]: {
        joinedAt: previous?.joinedAt ?? now, lastSeen: now,
        state: previous?.state ?? 'online', isTyping: previous?.isTyping ?? false, typingAt: previous?.typingAt ?? now,
      } },
    }, now);
    return users;
  });
  const member = result.snapshot.child(uid).val() as Member | null;
  if (member?.retired?.[connectionId] && member.retired[connectionId] > Date.now()) {
    throw new functions.https.HttpsError('failed-precondition', 'Connection closed. Reconnect with a new session.', { reason: 'connection-closed' });
  }
  if (!result.committed || !member || !isLive(member.connections?.[connectionId])) {
    if (Object.keys(member?.retired || {}).length >= MAX_RECENT_DISCONNECTS) {
      throw new functions.https.HttpsError('resource-exhausted', 'Too many reconnects. Please wait before opening another tab.');
    }
    if (!member && result.snapshot.numChildren() >= MAX_STORED_PROFILES) throw new functions.https.HttpsError('resource-exhausted', 'Room admission is temporarily busy. Please try again shortly.');
    const tooManyTabs = Object.keys(member?.connections || {}).length >= MAX_CONNECTIONS;
    throw new functions.https.HttpsError('resource-exhausted', tooManyTabs ? 'Too many open tabs (maximum 8)' : 'Chat room is full (maximum 20 users)');
  }
  const profile = { ...member };
  delete profile.retired;
  return profile;
});

export const leaveRoom = callable('leaveRoom', async (data: unknown, context) => {
  const uid = assertAuthedContext(context);
  const { connectionId } = payload(data, ['connectionId']);
  assertConnectionId(connectionId);
  await controlTransaction(`chatRoom/users/${uid}`, (member: Member | null) => {
    if (!member) return null;
    member = reconcile(member, Date.now());
    if (!member.connections?.[connectionId] && !member.retired?.[connectionId] &&
        Object.keys(member.retired || {}).length >= MAX_RECENT_DISCONNECTS) return member;
    const connections = { ...member.connections };
    delete connections[connectionId];
    return reconcile({ ...member, connections, retired: { ...member.retired, [connectionId]: Date.now() + 120_000 } }, Date.now());
  });
  return { left: true };
});

export const onSessionDisconnected = runtime.database.ref('/chatRoom/users/{uid}/connections/{connectionId}')
  .onDelete(async (_snapshot, context) => {
    await controlTransaction(`chatRoom/users/${context.params.uid}`, (member: Member | null) => {
      if (!member) return null;
      const connections = { ...member.connections };
      delete connections[context.params.connectionId];
      return reconcile({ ...member, connections,
        retired: { ...member.retired, [context.params.connectionId]: Date.now() + 120_000 } }, Date.now());
    });
  });
