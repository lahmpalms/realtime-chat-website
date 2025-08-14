import * as functions from 'firebase-functions';
import Filter from 'bad-words';
import { getDb } from './utils/database';
import { assertAuthedContext } from './utils/auth';

const MAX_LENGTH = 500;
const MAX_PER_MINUTE = 5;

const filter = new Filter();

async function getRateLimits(uid: string) {
  const snap = await getDb().ref(`rateLimits/${uid}`).get();
  return (snap.val() as any) || {};
}

async function setRateLimits(uid: string, data: any) {
  await getDb().ref(`rateLimits/${uid}`).set(data);
}

export const validateMessage = functions.https.onCall(async (data, context) => {
  const uid = assertAuthedContext(context);
  const text: string = (data?.text || '').toString();
  const now = Date.now();

  if (!text || typeof text !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Message text is required');
  }
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid message length');
  }
  if (filter.isProfane(trimmed)) {
    await getDb().ref(`rateLimits/${uid}/violations`).transaction((v) => (v || 0) + 1);
    throw new functions.https.HttpsError('failed-precondition', 'Message contains inappropriate content');
  }

  const limits = await getRateLimits(uid);
  const messageTimes: number[] = Array.isArray(limits.messages) ? limits.messages : [];
  const recent = messageTimes.filter((t) => now - t < 60000);
  if (recent.length >= MAX_PER_MINUTE) {
    const retryAfter = 60000 - (now - recent[0]);
    return { ok: false, code: 'rate_limited', retryAfterMs: retryAfter };
  }

  recent.push(now);
  await setRateLimits(uid, { ...limits, messages: recent.slice(-MAX_PER_MINUTE) });
  return { ok: true };
});

export const onMessageWrite = functions.database.ref('/chatRoom/messages/{messageId}')
  .onWrite(async (change, context) => {
    const after = change.after.val();
    if (!after) return null;
    const text: string = (after.text || '').toString();
    if (filter.isProfane(text)) {
      // Redact message text
      await change.after.ref.update({ text: '[redacted]' });
      await getDb().ref(`moderation/logs/${context.params.messageId}`).set({
        at: Date.now(),
        reason: 'profanity',
        userId: after.userId,
      });
    }
    return null;
  });


