import { controlTransaction } from './utils/controlTransaction';
import { getDb } from './utils/database';
import { Member, reconcile } from './sessionState';

export const MAX_STORED_MESSAGES = 1000;
export const MESSAGE_TTL_MS = 24 * 60 * 60_000;
export const MAX_STORED_PROFILES = 200;
export const PROFILE_TTL_MS = 7 * MESSAGE_TTL_MS;
export const REQUEST_CLOCK_SKEW_MS = 5 * 60_000;
export interface StoredMessage { id: string; userId: string; userName: string; userColor: string; text: string; timestamp: number }
export interface Room {
  users?: Record<string, Member>;
  messageIndex?: Record<string, number>;
  outbox?: Record<string, StoredMessage>;
  receipts?: Record<string, { hash: string; timestamp: number; created: number }>;
  deleteQueue?: Record<string, boolean>;
  rateLimits?: Record<string, { messages: number[] }>;
  roomRateLimit?: { messages: number[] };
  metadata?: { requestFloor?: number; [key: string]: unknown };
}
export function requestTime(id: string): number {
  return /^\d{13}_[A-Za-z0-9_-]{16,45}$/.test(id) ? Number(id.slice(0, 13)) : 0;
}
export function pruneUsers(current: Record<string, Member>, now: number, reserveFor?: string): Record<string, Member> {
  const users = Object.fromEntries(Object.entries(current).map(([id, member]) => [id, reconcile(member, now)] as const)
    .filter(([, member]) => Object.keys(member.connections || {}).length || member.lastSeen > now - PROFILE_TTL_MS));
  const target = MAX_STORED_PROFILES - (reserveFor && !users[reserveFor] ? 1 : 0);
  const evictable = Object.entries(users).filter(([id, member]) => id !== reserveFor && !Object.keys(member.connections || {}).length && !Object.keys(member.retired || {}).length)
    .sort((a, b) => a[1].lastSeen - b[1].lastSeen);
  while (Object.keys(users).length > target && evictable.length) delete users[evictable.shift()![0]];
  return users;
}
export function pruneRoom(current: Room | null, now = Date.now(), acknowledgements: Record<string, number> = {}, deletionAcks: Record<string, number> = {}): Room {
  const room = current || {};
  const ordered = Object.entries(room.messageIndex || {}).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const retained = ordered.filter(([, timestamp]) => timestamp > now - MESSAGE_TTL_MS).slice(-MAX_STORED_MESSAGES);
  const ids = new Set(retained.map(([id]) => id));
  const deleteQueue = Object.fromEntries(Object.entries(room.deleteQueue || {}).filter(([id]) => !deletionAcks[id]));
  const outbox = Object.fromEntries(Object.entries(room.outbox || {}).filter(([id]) => !acknowledgements[id]));
  for (const [id] of ordered) if (!ids.has(id)) deleteQueue[id] = true;
  let floor = room.metadata?.requestFloor || 0;
  const receipts = Object.fromEntries(Object.entries(room.receipts || {}).filter(([id, receipt]) => {
    if ((outbox[id] && !acknowledgements[id]) || receipt.timestamp > now - 60_000) return true;
    floor = Math.max(floor, receipt.created);
    return false;
  }));
  const rateLimits = Object.fromEntries(Object.entries(room.rateLimits || {}).map(([uid, quota]) => [uid, { messages: quota.messages.filter(time => time > now - 60_000) }] as const).filter(([, quota]) => quota.messages.length));
  return { ...room, outbox, users: pruneUsers(room.users || {}, now), messageIndex: Object.fromEntries(retained), deleteQueue, receipts, rateLimits,
    roomRateLimit: { messages: (room.roomRateLimit?.messages || []).filter(time => time > now - 60_000) }, metadata: { ...room.metadata, requestFloor: floor } };
}
export async function publishMessage(message: StoredMessage): Promise<StoredMessage | null> {
  const db = getDb();
  if (!(await db.ref(`chatRoom/messageIndex/${message.id}`).get()).exists()) {
    await db.ref(`chatMessageAcks/${message.id}`).set(Date.now());
    return null;
  }
  const result = await db.ref(`chatMessages/${message.id}`).transaction((saved: StoredMessage | null) => saved || message);
  const saved = result.snapshot.val() as StoredMessage;
  if (saved.text !== message.text || saved.userId !== message.userId) throw new Error('Outbox identity mismatch');
  await db.ref(`chatMessageAcks/${message.id}`).set(Date.now());
  // An old at-least-once trigger must not resurrect an evicted message.
  if (!(await db.ref(`chatRoom/messageIndex/${message.id}`).get()).exists()) {
    await db.ref(`chatMessages/${message.id}`).remove();
    return null;
  }
  return saved;
}
export async function drainDeletes() {
  const db = getDb();
  const pending = (await db.ref('chatRoom/deleteQueue').get()).val() as Record<string, boolean> | null;
  if (!pending) return;
  const updates: Record<string, null> = {};
  for (const id of Object.keys(pending)) { updates[`chatMessages/${id}`] = null;  }
  await db.ref().update(updates);
  await db.ref('chatDeletionAcks').update(Object.fromEntries(Object.keys(pending).map(id => [id, Date.now()])));
}
export async function readAcknowledgements() {
  const db = getDb();
  const [published, deleted] = await Promise.all([
    db.ref('chatMessageAcks').orderByValue().limitToLast(1100).get(),
    db.ref('chatDeletionAcks').orderByValue().limitToLast(1100).get(),
  ]);
  return { published: (published.val() || {}) as Record<string, number>, deleted: (deleted.val() || {}) as Record<string, number> };
}
export async function cleanAcknowledgements(room: Room, acknowledgements: Awaited<ReturnType<typeof readAcknowledgements>>) {
  const updates: Record<string, null> = {};
  for (const id of Object.keys(acknowledgements.published)) if (!room.outbox?.[id]) updates[`chatMessageAcks/${id}`] = null;
  for (const id of Object.keys(acknowledgements.deleted)) if (!room.deleteQueue?.[id]) updates[`chatDeletionAcks/${id}`] = null;
  if (Object.keys(updates).length) await getDb().ref().update(updates);
}
export async function runRetention() {
  const db = getDb();
  let attempts = 0;
  const acknowledgements = await readAcknowledgements();
  const result = await controlTransaction('chatRoom', (room: Room | null) => {
    attempts++; return pruneRoom(room, Date.now(), acknowledgements.published, acknowledgements.deleted);
  });
  if (!result.committed) throw new Error('Retention transaction was not committed');
  const room = (result.snapshot.val() || {}) as Room;
  await cleanAcknowledgements(room, acknowledgements);
  for (const message of Object.values(room.outbox || {})) await publishMessage(message);
  await drainDeletes();
  const archive = await db.ref('chatMessages').orderByChild('timestamp').limitToFirst(1100).get();
  const index = (await db.ref('chatRoom/messageIndex').get()).val() as Record<string, number> | null;
  const deletes: Record<string, null> = {};
  archive.forEach(child => { if (!index?.[child.key!] || child.child('timestamp').val() <= Date.now() - MESSAGE_TTL_MS) deletes[`chatMessages/${child.key}`] = null; });
  if (Object.keys(deletes).length) await db.ref().update(deletes);
  return { messages: Object.keys(room.messageIndex || {}).length, profiles: Object.keys(room.users || {}).length,
    quotaRecords: Object.keys(room.rateLimits || {}).length, bytes: Buffer.byteLength(JSON.stringify(room)), attempts };
}
