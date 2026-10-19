import { randomUUID } from 'node:crypto';
import * as functions from 'firebase-functions/v1';
import { getDb } from './database';

let tail: Promise<void> = Promise.resolve();
interface Lease { owner: string; expires: number }
// A small, private coordination lease avoids repeated room-sized CAS conflicts.
// The actual room transaction is still the correctness boundary, even if a worker
// stalls beyond the lease. A stale worker can never release a replacement lease.
export async function controlTransaction<T>(path: string, update: (current: T | null) => T | null | undefined) {
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  const lock = getDb().ref('chatControlLease');
  const owner = randomUUID();
  const deadline = Date.now() + 8000;
  let acquired = false;
  try {
    while (Date.now() < deadline) {
      try {
        const result = await lock.transaction((lease: Lease | null) => !lease || lease.expires < Date.now() || lease.owner === owner ? { owner, expires: Date.now() + 10_000 } : undefined);
        acquired = result.committed && result.snapshot.child('owner').val() === owner;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('maxretry')) throw error;
      }
      if (acquired) break;
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 100));
    }
    if (!acquired) throw new functions.https.HttpsError('aborted', 'The room is busy. Please retry your saved message.', { retryAfterMs: 1000 });
    return await getDb().ref(path).transaction(update);
  } finally {
    if (acquired) await lock.transaction((lease: Lease | null) => !lease || lease.owner === owner ? null : undefined).catch(() => { /* An abandoned lease expires; do not turn a committed operation into a failed acknowledgement. */ });
    release();
  }
}
