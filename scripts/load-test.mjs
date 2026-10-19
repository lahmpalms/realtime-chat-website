import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Load fixtures are restricted to local emulators');
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
const namespace = 'demo-realtime-chat-default-rtdb';
const base = `http://${host}`;
async function owner(path, options = {}) {
  const response = await fetch(`${base}/${path}.json?ns=${namespace}`, { ...options, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } });
  assert.equal(response.status, 200);
  return response.json();
}
const queues = new Map();
async function call(name, data, user) {
  const queuedAt = performance.now();
  const previous = queues.get(name) || Promise.resolve();
  let release;
  queues.set(name, new Promise(resolve => { release = resolve; }));
  // The emulator spawns extra workers and does not enforce first-gen maxInstances.
  // Model the configured one-instance FIFO; latency includes time in this queue.
  await previous;
  try { const result = await invoke(name, data, user); return { ...result, ms: performance.now() - queuedAt }; }
  finally { release(); }
}
async function invoke(name, data, user) {
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:5001/demo-realtime-chat/us-central1/${name}`, {
    method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` }, body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json(), ms: performance.now() - started };
}
const now = Date.now();
const profiles = Object.fromEntries(Array.from({ length: 180 }, (_, index) => {
  const id = `fixture-${index}`;
  return [id, { id, uid: id, name: 'Offline fixture', color: '#3B82F6', joinedAt: now - 3_600_000, lastSeen: now - 3_600_000, isOnline: false, isTyping: false, connectionState: 'offline', accessUntil: 0 }];
}));
const messages = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => {
  const timestamp = now - 3_600_000 + index;
  const id = `fixture_${timestamp}_${randomUUID()}`;
  return [id, { id, userId: 'fixture', userName: 'Fixture', userColor: '#3B82F6', text: 'ก'.repeat(500), timestamp }];
}));
await owner('', { method: 'PUT', body: JSON.stringify({ chatMessages: messages, chatRoom: { users: profiles, messageIndex: Object.fromEntries(Object.values(messages).map(message => [message.id, message.timestamp])) } }) });
const users = await Promise.all(Array.from({ length: 20 }, async () => {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return { ...await response.json(), connectionId: randomUUID() };
}));
const joined = await Promise.all(users.map(user => call('joinRoom', { name: 'Load guest', connectionId: user.connectionId }, user)));
for (const result of joined) assert.equal(result.status, 200, JSON.stringify(result));
const results = [];
let retries = 0;
await Promise.all(users.map(async user => {
  for (let index = 0; index < 5; index++) {
    const data = { text: `Load message ${index}`, requestId: `${Date.now()}_${randomUUID()}`, connectionId: user.connectionId };
    let result;
    const sendStarted = performance.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      result = await call('sendMessage', data, user);
      if (result.status === 200 || !['ABORTED', 'INTERNAL'].includes(result.body.error?.status)) break;
      retries++;
    }
    assert.equal(result.status, 200, JSON.stringify(result));
    result.ms = performance.now() - sendStarted;
    results.push(result);
    if (index === 2) assert.equal((await call('joinRoom', { name: 'Load guest', connectionId: user.connectionId }, user)).status, 200);
  }
}));
const room = await owner('chatRoom');
const current = Object.values(await owner('chatMessages'));
assert.equal(current.length, 1000);
assert.equal(current.filter(message => message.text.startsWith('Load message')).length, 100);
assert.ok(Object.keys(room.users).length <= 200);
for (const user of users) assert.equal(room.rateLimits[user.localId].messages.length, 5);
assert.equal(room.roomRateLimit.messages.length, 100);
const sorted = results.map(result => result.ms).sort((a, b) => a - b);
const report = { fixture: { profiles: 200, retainedMessages: 1000, initialMessageCharacters: 500, activeUsers: 20 },
  executionConcurrencyPerFunction: 1, queueModel: 'FIFO matching configured first-gen maxInstances; latency includes queue and retries',
  accepted: results.length, retries, p50Ms: Math.round(sorted[Math.ceil(sorted.length * 0.5) - 1]),
  p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]), maxMs: Math.round(sorted.at(-1)),
  roomBytes: Buffer.byteLength(JSON.stringify(room)) };
console.log(JSON.stringify(report, null, 2));
if (process.env.CHAT_LOAD_REPORT) await writeFile(process.env.CHAT_LOAD_REPORT, JSON.stringify(report, null, 2) + '\n');
assert.ok(report.p95Ms < 10_000, 'Local regression ceiling exceeded; review contention before staging');
