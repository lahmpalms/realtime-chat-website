import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pruneRoom, pruneUsers, runRetention, publishMessage, MAX_STORED_MESSAGES, MAX_STORED_PROFILES } from '../functions/lib/retention.js';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getDb } = require('../functions/lib/utils/database.js');
assert.match(process.env.FIREBASE_DATABASE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
const app = initializeApp({ projectId: 'demo-realtime-chat' });
const db = getDb();
beforeEach(async () => db.ref().set(null));
after(async () => deleteApp(app));
const profile = (id, lastSeen, extra = {}) => ({ id, uid: id, name: 'Test', color: '#3B82F6', joinedAt: lastSeen,
  lastSeen, accessUntil: 0, isOnline: false, isTyping: false, connectionState: 'offline', ...extra });
const message = (time, index = '') => {
  const id = `sender_${time}_${randomUUID()}`;
  return { id, userId: 'sender', userName: 'Sender', userColor: '#3B82F6', text: `Message ${index}`, timestamp: time };
};

test('retention removes expired messages and advances the retry floor with a hard count cap', () => {
  const now = Date.now();
  const messages = Array.from({ length: 1002 }, (_, index) => message(now - 10_000 + index, index));
  messages.push(message(now - 86_400_001));
  const result = pruneRoom({ messageIndex: Object.fromEntries(messages.map(value => [value.id, value.timestamp])), rateLimits: {
    old: { messages: [now - 60_001] }, mixed: { messages: [now - 60_001, now - 100] },
  } }, now);
  assert.equal(Object.keys(result.messageIndex).length, MAX_STORED_MESSAGES);
  assert.equal(Object.keys(result.deleteQueue).length, 3);
  assert.deepEqual(result.rateLimits, { mixed: { messages: [now - 100] } });
  assert.deepEqual(pruneRoom(result, now), result);
});

test('profile cache prunes TTL and oldest inactive profiles, preserving live and retired admissions', () => {
  const now = Date.now();
  const live = profile('live', now, { connections: { connection: { lastSeen: now, joinedAt: now, state: 'online', isTyping: false, typingAt: now } } });
  const retired = profile('retired', now - 10_000, { retired: { closed: now + 120_000 } });
  const users = { live, retired, ancient: profile('ancient', now - 8 * 86_400_000),
    ...Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`old-${index}`, profile(`old-${index}`, now - 100_000 + index)])) };
  const result = pruneUsers(users, now, 'new-guest');
  assert.equal(Object.keys(result).length, MAX_STORED_PROFILES - 1);
  assert.ok(result.live.connections.connection);
  assert.ok(result.retired.retired.closed);
  assert.equal(result.ancient, undefined);
  assert.equal(result['old-0'], undefined);
});

test('scheduled retention implementation compacts real emulator state and is repeatable', async () => {
  const now = Date.now();
  const old = message(now - 86_400_001);
  const recent = message(now);
  await db.ref().set({ chatRoom: { users: { expired: profile('expired', now - 8 * 86_400_000) },
    messageIndex: { [old.id]: old.timestamp, [recent.id]: recent.timestamp }, rateLimits: { expired: { messages: [now - 61_000] } } }, chatMessages: { [old.id]: old, [recent.id]: recent } });
  const result = await runRetention();
  assert.equal(result.messages, 1);
  assert.equal(result.profiles, 0);
  assert.equal(result.quotaRecords, 0);
  assert.equal((await runRetention()).messages, 1);
});

test('backup/restore verifies integrity, makes a safety backup and never restores live sessions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chat-backup-'));
  const backup = join(directory, 'room.json');
  const safety = join(directory, 'before.json');
  const run = promisify(execFile);
  const now = Date.now();
  const saved = message(now);
  const original = { chatRoom: { users: { sender: profile('sender', now, { accessUntil: now + 90_000,
    connections: { active: { lastSeen: now, joinedAt: now, state: 'online', isTyping: true, typingAt: now } } }) }, messageIndex: { [saved.id]: saved.timestamp } }, chatMessages: { [saved.id]: saved } };
  try {
    await db.ref().set(original);
    await run(process.execPath, ['scripts/database-backup.mjs', 'backup', '--project', 'demo-realtime-chat', '--output', backup]);
    await db.ref('chatMessages').set(null);
    await run(process.execPath, ['scripts/database-backup.mjs', 'restore', '--project', 'demo-realtime-chat', '--confirm-project', 'demo-realtime-chat', '--source', backup, '--before', safety]);
    const restored = (await db.ref().get()).val();
    assert.equal(restored.chatMessages[saved.id].text, saved.text);
    assert.equal(restored.chatRoom.users.sender.accessUntil, 0);
    assert.equal(restored.chatRoom.users.sender.connections, undefined);
    assert.equal(JSON.parse(await readFile(safety, 'utf8')).chatMessages, null);
    const corrupt = JSON.parse(await readFile(backup, 'utf8'));
    corrupt.chatMessages[saved.id].text = 'tampered';
    await writeFile(join(directory, 'corrupt.json'), JSON.stringify(corrupt));
    await assert.rejects(run(process.execPath, ['scripts/database-backup.mjs', 'restore', '--project', 'demo-realtime-chat', '--confirm-project', 'demo-realtime-chat', '--source', join(directory, 'corrupt.json'), '--before', join(directory, 'bad-before.json')]));
    await assert.rejects(run(process.execPath, ['scripts/database-backup.mjs', 'restore', '--project', 'demo-realtime-chat', '--confirm-project', 'wrong-project', '--source', backup, '--before', join(directory, 'wrong-before.json')]));
    assert.equal((await db.ref(`chatMessages/${saved.id}`).get()).val().text, saved.text);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('a durable outbox repairs interrupted delivery and stale publishers cannot resurrect evicted history', async () => {
  const saved = message(Date.now());
  await db.ref('chatRoom').set({ messageIndex: { [saved.id]: saved.timestamp }, outbox: { [saved.id]: saved } });
  await runRetention();
  assert.equal((await db.ref(`chatMessages/${saved.id}`).get()).val().text, saved.text);
  await runRetention();
  assert.equal((await db.ref('chatRoom/outbox').get()).val(), null);
  await db.ref().update({ [`chatRoom/messageIndex/${saved.id}`]: null, [`chatMessages/${saved.id}`]: null });
  assert.equal(await publishMessage(saved), null);
  assert.equal((await db.ref(`chatMessages/${saved.id}`).get()).val(), null);
});


test('offline schema migration bounds history and discards legacy admissions before restore', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chat-migration-'));
  const run = promisify(execFile);
  const saved = message(Date.now());
  const expired = message(Date.now() - 86_400_001);
  try {
    const source = join(directory, 'raw.json');
    const output = join(directory, 'migrated.json');
    await writeFile(source, JSON.stringify({ chatRoom: { users: { legacy: { admin: true } }, messages: { [saved.id]: saved, [expired.id]: expired } } }));
    await run(process.execPath, ['scripts/migrate-phase4.mjs', '--source', source, '--output', output, '--project', 'demo-realtime-chat']);
    const migrated = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(migrated.chatRoom.users, {});
    assert.deepEqual(migrated.chatRoom.deleteQueue, {});
    assert.equal(Object.keys(migrated.chatMessages).length, 1);
    await run(process.execPath, ['scripts/database-backup.mjs', 'restore', '--project', 'demo-realtime-chat', '--confirm-project', 'demo-realtime-chat', '--source', output, '--before', join(directory, 'safety.json')]);
    assert.equal((await db.ref(`chatMessages/${saved.id}`).get()).val().text, saved.text);
    assert.equal((await db.ref('chatRoom/users').get()).val(), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
