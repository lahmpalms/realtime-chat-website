import { controlTransaction } from './utils/controlTransaction';
import * as functions from 'firebase-functions/v1';
import { createHash } from 'node:crypto';
import Filter from 'bad-words';
import { getDb } from './utils/database';
import { assertAuthedContext } from './utils/auth';
import { Room, StoredMessage, pruneRoom, requestTime, MESSAGE_TTL_MS, REQUEST_CLOCK_SKEW_MS, publishMessage, drainDeletes, readAcknowledgements, cleanAcknowledgements } from './retention';
import { callable } from './observability';
import { payload, assertConnectionId, isLive } from './sessions';
const filter = new Filter();

export const sendMessage = callable('sendMessage', async (data: unknown, context) => {
  const uid = assertAuthedContext(context);
  const { text, requestId, connectionId } = payload(data, ['text', 'requestId', 'connectionId']);
  assertConnectionId(connectionId);
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 500 || typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(requestId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid message text or request ID');
  }
  const trimmed = text.trim();
  if (filter.isProfane(trimmed)) throw new functions.https.HttpsError('failed-precondition', 'Message contains inappropriate content');
  const db = getDb();
  const id = `${uid}_${requestId}`;
  const existing = (await db.ref(`chatMessages/${id}`).get()).val() as StoredMessage | null;
  if (existing) {
    if (existing.userId !== uid || existing.text !== trimmed) throw new functions.https.HttpsError('already-exists', 'Request ID already used for another message');
    return existing;
  }
  const hash = createHash('sha256').update(trimmed).digest('hex');
  const acknowledgements = await readAcknowledgements();
  const result = await controlTransaction('chatRoom', (current: Room | null) => {
    const room = pruneRoom(current, Date.now(), acknowledgements.published, acknowledgements.deleted);
    const now = Date.now();
    if (room.receipts?.[id]) return room;
    const member = room.users?.[uid];
    if (!member || !isLive(member.connections?.[connectionId], now)) return room;
    const created = requestTime(requestId);
    if (!created || created <= (room.metadata?.requestFloor || 0) || created <= now - MESSAGE_TTL_MS || created > now + REQUEST_CLOCK_SKEW_MS) return room;
    const recent = room.rateLimits?.[uid]?.messages || [];
    const global = room.roomRateLimit?.messages || [];
    if (recent.length >= 5 || global.length >= 100 || Object.keys(room.outbox || {}).length >= 100 || Object.keys(room.deleteQueue || {}).length >= 1000) return room;
    const message: StoredMessage = { id, userId: uid, userName: member.name, userColor: member.color, text: trimmed, timestamp: now };
    return pruneRoom({ ...room, outbox: { ...room.outbox, [id]: message }, messageIndex: { ...room.messageIndex, [id]: now },
      receipts: { ...room.receipts, [id]: { hash, timestamp: now, created } }, rateLimits: { ...room.rateLimits, [uid]: { messages: [...recent, now] } }, roomRateLimit: { messages: [...global, now] } }, now);
  });
  if (!result.committed) throw new functions.https.HttpsError('aborted', 'Message could not be committed. Please retry.');
  const room = (result.snapshot.val() || {}) as Room;
  await cleanAcknowledgements(room, acknowledgements);
  const receipt = room.receipts?.[id];
  if (receipt) {
    if (receipt.hash !== hash) throw new functions.https.HttpsError('already-exists', 'Request ID already used for another message');
    const queued = room.outbox?.[id];
    const saved = queued ? await publishMessage(queued) : (await db.ref(`chatMessages/${id}`).get()).val() as StoredMessage | null;
    if (!saved) throw new functions.https.HttpsError('aborted', 'Delivery is pending. Please retry this saved message.');
    await drainDeletes();
    return saved;
  }
  if (!isLive(room.users?.[uid]?.connections?.[connectionId])) throw new functions.https.HttpsError('failed-precondition', 'Reconnect to the room before sending messages', { reason: 'session-expired' });
  const created = requestTime(requestId);
  if (!created || created <= (room.metadata?.requestFloor || 0) || created <= Date.now() - MESSAGE_TTL_MS || created > Date.now() + REQUEST_CLOCK_SKEW_MS) {
    throw new functions.https.HttpsError('failed-precondition', 'This saved send has expired or its time is invalid. Edit the message before sending it again.', { reason: 'request-expired' });
  }
  const recent = (room.roomRateLimit?.messages || []).length >= 100 ? room.roomRateLimit!.messages : room.rateLimits?.[uid]?.messages || [];
  const retryAfterMs = recent.length ? Math.max(1, 60_000 - (Date.now() - Math.min(...recent))) : 5000;
  throw new functions.https.HttpsError('resource-exhausted', 'The room is busy or the message limit was reached. Please wait and retry.', { retryAfterMs });
});
