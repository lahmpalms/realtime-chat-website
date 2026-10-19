import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, query, orderByChild, limitToLast, ref, set, get, update, onDisconnect, serverTimestamp, goOffline } from 'firebase/database';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const projectId = 'demo-realtime-chat';
// Refuse to run destructive test fixtures against a live project.
assert.ok(process.env.FIREBASE_DATABASE_EMULATOR_HOST, 'Start tests with npm run test:security');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Auth emulator is required');
const namespace = `${projectId}-default-rtdb`;
const databaseURL = `https://${namespace}.firebaseio.com`;
const functionsURL = `http://127.0.0.1:5001/${projectId}/us-central1`;
let env;
const fixtureIds = new Map();

before(async () => {
  const [host, port] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({
    projectId: namespace,
    database: { host, port: Number(port), rules: await readFile('firebase-rules.json', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  fixtureIds.clear();
  await env.withSecurityRulesDisabled(async context => { await context.database(databaseURL).ref().set(null); });
});

function db(uid) {
  return (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database(databaseURL);
}
async function adminRead(path) {
  let value;
  await env.withSecurityRulesDisabled(async context => { value = (await context.database(databaseURL).ref(path).get()).val(); });
  return value;
}
async function seed(value) {
  if (value.chatRoom?.messages) { value.chatMessages = value.chatRoom.messages; delete value.chatRoom.messages; }
  await env.withSecurityRulesDisabled(async context => { await context.database(databaseURL).ref().set(value); });
}
const fixtureId = id => { if (!fixtureIds.has(id)) fixtureIds.set(id, randomUUID()); return fixtureIds.get(id); };
function member(id, extra = {}) {
  const now = Date.now();
  return { id, uid: id, name: `User ${id}`, color: '#3B82F6', joinedAt: now, lastSeen: now,
    isTyping: false, isOnline: true, connectionState: 'online', accessUntil: now + 90_000,
    connections: { [fixtureId(id)]: { joinedAt: now, lastSeen: now, state: 'online', isTyping: false, typingAt: now } }, ...extra };
}
const activeCount = users => Object.values(users || {}).filter(user => Object.values(user.connections || {}).some(connection => connection.lastSeen + 90_000 > Date.now())).length;
async function anonymous() {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function call(name, data, user) {
  const response = await fetch(`${functionsURL}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  return { status: response.status, ...body };
}
function connectionId(user) { return user.connectionId ||= randomUUID(); }
async function join(user, name = 'Alice') {
  const response = await call('joinRoom', { name, connectionId: connectionId(user) }, user);
  assert.equal(response.status, 200, JSON.stringify(response));
  return response.result;
}
const requestIdForSend = () => `${Date.now()}_${randomUUID()}`;
const send = (user, text = 'Hello', requestId = requestIdForSend()) => call('sendMessage', { text, requestId, connectionId: connectionId(user) }, user);
const errorIs = (result, code) => assert.equal(result.error?.status, code, JSON.stringify(result));

// Real database rules, not mocks of authorization decisions.
test('unauthenticated and unjoined clients cannot read collections or root', async () => {
  await seed({ chatRoom: { users: { alice: member('alice') }, messages: { one: { text: 'private to members' } }, rateLimits: { alice: { messages: [1] } } } });
  for (const uid of [undefined, 'outsider']) {
    for (const path of ['/', 'chatRoom', 'chatRoom/users', 'chatMessages', 'chatRoom/presence', 'chatRoom/typing', 'chatRoom/rateLimits']) {
      await assertFails(db(uid).ref(path).get());
    }
  }
  await assertSucceeds(db('alice').ref('chatMessages').orderByChild('timestamp').limitToLast(50).get());
  await assertSucceeds(db('alice').ref('chatRoom/users').orderByChild('accessUntil').limitToLast(20).get());
  await assertFails(db('alice').ref('chatRoom').get());
  await assertFails(db('alice').ref('chatRoom/rateLimits').get());
});

test('root deletes, membership creation, message writes and private state tampering are denied', async () => {
  await seed({ chatRoom: { users: { alice: member('alice'), bob: member('bob') }, messages: { one: { text: 'existing' } } } });
  const alice = db('alice');
  for (const [path, value] of [
    ['/', null], ['chatRoom', null], ['chatRoom/users', null],
    ['chatRoom/users/bob', null], ['chatRoom/users/outsider', member('outsider')],
    ['chatMessages/one', null], ['chatMessages/forged', { userId: 'alice', text: 'forged' }],
    ['chatRoom/rateLimits/alice', null], ['rateLimits/alice', {}], ['moderation/logs', {}],
    ['chatRoom/metadata', { maxUsers: 999 }],
  ]) await assertFails(alice.ref(path).set(value));
  await assertFails(db('outsider').ref('chatRoom/users/outsider').set(member('outsider')));
  await assertFails(alice.ref().update({ 'chatRoom/users/alice/name': 'Forged', 'chatRoom/rateLimits/alice': null }));
  assert.equal((await adminRead('chatRoom/users/alice')).name, 'User alice');
});

test('profiles and leases are server-only; clients can only update or delete their own existing connection activity', async () => {
  await seed({ chatRoom: { users: { alice: member('alice'), bob: member('bob') } } });
  const alice = db('alice');
  const connection = alice.ref(`chatRoom/users/alice/connections/${fixtureId('alice')}`);
  await assertSucceeds(connection.update({ state: 'away', isTyping: true, typingAt: Date.now() }));
  for (const patch of [{ id: 'bob' }, { name: 'Bob' }, { color: '#FFFFFF' }, { accessUntil: Date.now() + 999_999 }, { lastSeen: Date.now() }, { admin: true }]) {
    await assertFails(alice.ref('chatRoom/users/alice').update(patch));
  }
  await assertFails(alice.ref('chatRoom/users/alice').remove());
  for (const patch of [{ lastSeen: Date.now() + 100 }, { joinedAt: 1 }, { state: 'invalid' }, { injected: true }, { typingAt: Date.now() + 120_000 }]) {
    await assertFails(connection.update(patch));
  }
  await assertFails(alice.ref('chatRoom/users/alice/connections/new-connection-1234').set(member('alice').connections[fixtureId('alice')]));
  await assertFails(db('bob').ref(`chatRoom/users/alice/connections/${fixtureId('alice')}`).remove());
  await assertFails(alice.ref('chatRoom/presence/alice').set({ isOnline: true }));
  await assertFails(alice.ref('chatRoom/typing/alice').set({ userName: 'Bob' }));
  await assertSucceeds(connection.remove());
  await assertFails(alice.ref('chatMessages').get());
});

test('callables require real auth and validate all input on the server', async () => {
  errorIs(await call('joinRoom', { name: 'Alice' }), 'UNAUTHENTICATED');
  errorIs(await call('joinRoom', { name: 'Alice' }, { idToken: 'forged-token' }), 'UNAUTHENTICATED');
  errorIs(await call('sendMessage', { text: 'Hello', requestId: randomUUID() }), 'UNAUTHENTICATED');
  const user = await anonymous();
  for (const data of [null, [], { name: '' }, { name: 'x'.repeat(21) }, { name: 'Line\nBreak' }, { name: 123 }, { name: 'Alice', color: '#FFFFFF' }]) {
    errorIs(await call('joinRoom', data && !Array.isArray(data) ? { ...data, connectionId: connectionId(user) } : data, user), 'INVALID_ARGUMENT');
  }
  errorIs(await send(user), 'FAILED_PRECONDITION');
  user.connectionId = randomUUID();
  await join(user);
  for (const data of [null, [], { text: {}, requestId: randomUUID() }, { text: ' ', requestId: randomUUID() }, { text: 'x'.repeat(501), requestId: randomUUID() }, { text: 'Hello', requestId: '../invalid' }, { text: 'Hello', requestId: randomUUID(), userId: 'victim' }]) {
    errorIs(await call('sendMessage', data && !Array.isArray(data) ? { ...data, connectionId: connectionId(user) } : data, user), 'INVALID_ARGUMENT');
  }
  errorIs(await send(user, 'shit'), 'FAILED_PRECONDITION');
  assert.equal(await adminRead('chatMessages'), null);
  assert.equal(await adminRead(`chatRoom/rateLimits/${user.localId}`), null);
});

test('messages use server identity and time; duplicate requests charge quota once', async () => {
  const user = await anonymous();
  const profile = await join(user, 'Alice');
  const id = requestIdForSend();
  const before = Date.now();
  const results = await Promise.all(Array.from({ length: 6 }, () => send(user, '  Hello  ', id)));
  for (const response of results) {
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal(response.result.userId, user.localId);
    assert.equal(response.result.userName, profile.name);
    assert.equal(response.result.userColor, profile.color);
    assert.equal(response.result.text, 'Hello');
    assert.ok(response.result.timestamp >= before && response.result.timestamp <= Date.now());
  }
  assert.equal(Object.keys(await adminRead('chatMessages')).length, 1);
  assert.equal((await adminRead(`chatRoom/rateLimits/${user.localId}/messages`)).length, 1);
  errorIs(await send(user, 'Different text', id), 'ALREADY_EXISTS');
});

test('concurrent sends never exceed five messages and quotas survive leave/rejoin', async () => {
  const user = await anonymous();
  await join(user);
  const results = await Promise.all(Array.from({ length: 12 }, () => send(user)));
  const accepted = results.filter(response => response.status === 200);
  assert.equal(accepted.length, 5, JSON.stringify(results));
  for (const response of results.filter(response => response.status !== 200)) {
    errorIs(response, 'RESOURCE_EXHAUSTED');
    assert.ok(response.error.details.retryAfterMs > 0 && response.error.details.retryAfterMs <= 60_000);
  }
  assert.equal(Object.keys(await adminRead('chatMessages')).length, 5);
  assert.equal((await adminRead(`chatRoom/rateLimits/${user.localId}/messages`)).length, 5);
  assert.equal((await call('leaveRoom', { connectionId: connectionId(user) }, user)).status, 200);
  errorIs(await send(user), 'FAILED_PRECONDITION');
  user.connectionId = randomUUID();
  await join(user);
  errorIs(await send(user), 'RESOURCE_EXHAUSTED');
});

test('expired quota entries are pruned using server time', async () => {
  const user = await anonymous();
  await join(user);
  await env.withSecurityRulesDisabled(async context => {
    await context.database(databaseURL).ref(`chatRoom/rateLimits/${user.localId}`).set({ messages: Array(5).fill(Date.now() - 61_000) });
  });
  assert.equal((await send(user)).status, 200);
  assert.equal((await adminRead(`chatRoom/rateLimits/${user.localId}/messages`)).length, 1);
});

test('concurrent joins cap membership at twenty; rejoin is idempotent and departure frees a slot', async () => {
  const users = await Promise.all(Array.from({ length: 24 }, () => anonymous()));
  const results = await Promise.all(users.map(user => call('joinRoom', { name: 'Guest', connectionId: connectionId(user) }, user)));
  assert.equal(results.filter(result => result.status === 200).length, 20, JSON.stringify(results));
  for (const result of results.filter(result => result.status !== 200)) errorIs(result, 'RESOURCE_EXHAUSTED');
  const admittedIndex = results.findIndex(result => result.status === 200);
  const rejectedIndex = results.findIndex(result => result.status !== 200);
  const admitted = users[admittedIndex];
  const rejoined = await join(admitted, 'Changed name');
  for (const field of ['id', 'name', 'color', 'joinedAt']) assert.equal(rejoined[field], results[admittedIndex].result[field]);
  assert.equal(activeCount(await adminRead('chatRoom/users')), 20);
  assert.equal((await call('leaveRoom', { connectionId: connectionId(admitted) }, admitted)).status, 200);
  await join(users[rejectedIndex]);
  assert.equal(activeCount(await adminRead('chatRoom/users')), 20);
});


test('Firebase client SDK can authenticate, register disconnects, join, send and leave with the deployed rules', { timeout: 30_000 }, async () => {
  const app = initializeApp({ projectId, apiKey: 'demo-key', databaseURL }, `client-${randomUUID()}`);
  const auth = getAuth(app);
  const database = getDatabase(app);
  try {
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const [host, port] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
    connectDatabaseEmulator(database, host, Number(port));
    const functions = getFunctions(app);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    const { user } = await signInAnonymously(auth);
    const id = randomUUID();
    const path = `chatRoom/users/${user.uid}/connections/${id}`;
    await onDisconnect(ref(database, path)).remove();
    const { data: profile } = await httpsCallable(functions, 'joinRoom')({ name: 'SDK User', connectionId: id });
    assert.equal(profile.id, user.uid);
    await update(ref(database, path), { state: 'online', isTyping: true, typingAt: serverTimestamp() });
    const { data: message } = await httpsCallable(functions, 'sendMessage')({ text: 'SDK message', requestId: requestIdForSend(), connectionId: id });
    const snapshot = await get(query(ref(database, 'chatMessages'), orderByChild('timestamp'), limitToLast(50)));
    assert.equal(snapshot.val()[message.id].text, 'SDK message');
    await httpsCallable(functions, 'leaveRoom')({ connectionId: id });
    assert.equal(await adminRead(path), null);
  } finally {
    goOffline(database);
    await signOut(auth);
    await deleteApp(app);
  }
});

test('leaving or delayed cleanup of one tab preserves other tabs and identity', async () => {
  const user = await anonymous();
  const first = await join(user);
  const firstId = connectionId(user);
  const secondId = randomUUID();
  const second = await call('joinRoom', { name: 'Different tab name', connectionId: secondId }, user);
  assert.equal(second.result.name, first.name);
  assert.equal(Object.keys(second.result.connections).length, 2);
  assert.equal((await call('leaveRoom', { connectionId: firstId }, user)).status, 200);
  errorIs(await send(user), 'FAILED_PRECONDITION');
  assert.equal((await call('sendMessage', { text: 'Still here', requestId: requestIdForSend(), connectionId: secondId }, user)).status, 200);
  await assertSucceeds(db(user.localId).ref(`chatRoom/users/${user.localId}/connections/${firstId}`).remove());
  assert.ok(await adminRead(`chatRoom/users/${user.localId}/connections/${secondId}`));
  assert.equal((await adminRead(`chatRoom/users/${user.localId}`)).color, first.color);
});

test('stale sessions cannot renew themselves, send or hold room capacity indefinitely', async () => {
  const stale = member('stale');
  stale.connections[fixtureId('stale')].lastSeen = Date.now() - 91_000;
  stale.accessUntil = Date.now() - 1000;
  const users = { stale, ...Object.fromEntries(Array.from({ length: 19 }, (_, index) => [`active${index}`, member(`active${index}`)])) };
  await seed({ chatRoom: { users } });
  await assertFails(db('stale').ref(`chatRoom/users/stale/connections/${fixtureId('stale')}`).update({ state: 'online', typingAt: Date.now() }));
  await assertFails(db('stale').ref('chatRoom/users').get());
  const user = await anonymous();
  await join(user);
  assert.equal(activeCount(await adminRead('chatRoom/users')), 20);
  assert.equal(await adminRead('chatRoom/users/stale/connections'), null);
});

test('a lost response can be confirmed after departure without charging quota again', async () => {
  const user = await anonymous();
  await join(user);
  const requestId = requestIdForSend();
  const sent = await send(user, 'Lost acknowledgement', requestId);
  assert.equal(sent.status, 200);
  await call('leaveRoom', { connectionId: connectionId(user) }, user);
  const confirmed = await send(user, 'Lost acknowledgement', requestId);
  assert.deepEqual(confirmed.result, sent.result);
  assert.equal((await adminRead(`chatRoom/rateLimits/${user.localId}/messages`)).length, 1);
  errorIs(await send(user, 'Brand new message'), 'FAILED_PRECONDITION');
});

test('tab admission is bounded per UID and server lease/identity cannot be forged', async () => {
  const user = await anonymous();
  for (let index = 0; index < 8; index++) {
    assert.equal((await call('joinRoom', { name: 'Tabs', connectionId: randomUUID() }, user)).status, 200);
  }
  errorIs(await call('joinRoom', { name: 'Tabs', connectionId: randomUUID() }, user), 'RESOURCE_EXHAUSTED');
  errorIs(await call('joinRoom', { name: 'Tabs', connectionId: '../bad' }, user), 'INVALID_ARGUMENT');
  errorIs(await call('leaveRoom', { connectionId: randomUUID() }), 'UNAUTHENTICATED');
});


test('retired connection IDs reject delayed joins without removing replacement sessions', async () => {
  const user = await anonymous();
  await join(user);
  const old = connectionId(user);
  await call('leaveRoom', { connectionId: old }, user);
  const delayed = await call('joinRoom', { name: 'Alice', connectionId: old }, user);
  errorIs(delayed, 'FAILED_PRECONDITION');
  assert.equal(delayed.error.details.reason, 'connection-closed');
  user.connectionId = randomUUID();
  const replacement = await join(user);
  assert.ok(replacement.connections[user.connectionId]);
  await assertSucceeds(db(user.localId).ref(`chatRoom/users/${user.localId}/connections/${old}`).remove());
  assert.ok(await adminRead(`chatRoom/users/${user.localId}/connections/${user.connectionId}`));
});

test('reconnect history is bounded without interrupting an existing live connection', async () => {
  const user = await anonymous();
  await join(user);
  const retired = Object.fromEntries(Array.from({ length: 64 }, () => [randomUUID(), Date.now() + 120_000]));
  await env.withSecurityRulesDisabled(async context => {
    await context.database(databaseURL).ref(`chatRoom/users/${user.localId}/retired`).set(retired);
  });
  errorIs(await call('joinRoom', { name: 'Alice', connectionId: randomUUID() }, user), 'RESOURCE_EXHAUSTED');
  await call('leaveRoom', { connectionId: randomUUID() }, user);
  assert.equal(Object.keys(await adminRead(`chatRoom/users/${user.localId}/retired`)).length, 64);
  await join(user);
  assert.equal((await send(user)).status, 200);
});

test('membership does not grant unbounded, wrongly ordered or oversized history/presence queries', async () => {
  await seed({ chatRoom: { users: { alice: member('alice') } } });
  const database = db('alice');
  for (const [path, child, cap] of [['messages', 'timestamp', 50], ['users', 'accessUntil', 20]]) {
    const target = path === 'messages' ? 'chatMessages' : 'chatRoom/users';
    const collection = database.ref(target);
    await assertFails(collection.get());
    await assertFails(collection.orderByChild(child).get());
    await assertFails(collection.orderByChild(child).limitToLast(cap + 1).get());
    await assertFails(collection.orderByKey().limitToLast(cap).get());
    await assertSucceeds(collection.orderByChild(child).limitToLast(cap).get());
    await assertFails(db('outsider').ref(target).orderByChild(child).limitToLast(cap).get());
  }
  await assertSucceeds(database.ref('chatRoom/users/alice').get());
  await assertFails(database.ref('chatRoom/roomRateLimit').get());
});

test('expired or evicted request IDs cannot create duplicate messages after retention', async () => {
  const user = await anonymous();
  await join(user);
  const id = requestIdForSend();
  const sent = await send(user, 'Previously saved', id);
  assert.equal(sent.status, 200);
  await env.withSecurityRulesDisabled(async context => {
    await context.database(databaseURL).ref().update({ chatMessages: null, 'chatRoom/messageIndex': null, 'chatRoom/outbox': null, 'chatRoom/receipts': null, 'chatRoom/metadata/requestFloor': Number(id.slice(0, 13)) });
  });
  const replay = await send(user, 'Previously saved', id);
  errorIs(replay, 'FAILED_PRECONDITION');
  assert.equal(replay.error.details.reason, 'request-expired');
  errorIs(await send(user, 'Too old', `${Date.now() - 86_400_001}_${randomUUID()}`), 'FAILED_PRECONDITION');
  errorIs(await send(user, 'Future', `${Date.now() + 600_000}_${randomUUID()}`), 'FAILED_PRECONDITION');
  assert.equal(await adminRead('chatMessages'), null);
  assert.equal((await adminRead(`chatRoom/rateLimits/${user.localId}/messages`)).length, 1);
});

test('room-wide quota bounds anonymous UID churn without charging rejected sends', async () => {
  const user = await anonymous();
  await join(user);
  await env.withSecurityRulesDisabled(async context => {
    await context.database(databaseURL).ref('chatRoom/roomRateLimit').set({ messages: Array(100).fill(Date.now()) });
  });
  const rejected = await send(user);
  errorIs(rejected, 'RESOURCE_EXHAUSTED');
  assert.ok(rejected.error.details.retryAfterMs > 0);
  assert.equal(await adminRead(`chatRoom/rateLimits/${user.localId}`), null);
  assert.equal(await adminRead('chatMessages'), null);
});


test('an interrupted outbox send remains confirmable after the compact receipt horizon without charging again', async () => {
  const user = await anonymous();
  const profile = await join(user);
  const timestamp = Date.now() - 61_000;
  const request = `${timestamp}_${randomUUID()}`;
  const id = `${user.localId}_${request}`;
  const saved = { id, userId: user.localId, userName: profile.name, userColor: profile.color, text: 'Pending recovery', timestamp };
  await env.withSecurityRulesDisabled(async context => {
    await context.database(databaseURL).ref('chatRoom').update({
      [`messageIndex/${id}`]: timestamp, [`outbox/${id}`]: saved,
      [`receipts/${id}`]: { hash: createHash('sha256').update(saved.text).digest('hex'), timestamp, created: timestamp },
      [`rateLimits/${user.localId}/messages`]: [timestamp], 'metadata/requestFloor': timestamp + 1000,
    });
  });
  const confirmed = await send(user, saved.text, request);
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed));
  assert.deepEqual(confirmed.result, saved);
  assert.equal(await adminRead(`chatRoom/rateLimits/${user.localId}`), null);
  assert.equal(Object.keys(await adminRead('chatMessages')).length, 1);
});


test('prototype-property connection IDs cannot bypass the eight-tab admission limit', async () => {
  const user = await anonymous();
  await join(user);
  for (let index = 1; index < 8; index++) {
    assert.equal((await call('joinRoom', { name: 'Alice', connectionId: randomUUID() }, user)).status, 200);
  }
  const names = Object.getOwnPropertyNames(Object.prototype).filter(name => /^[A-Za-z0-9_-]{16,64}$/.test(name));
  assert.ok(names.length > 0);
  for (const connectionId of names) errorIs(await call('joinRoom', { name: 'Alice', connectionId }, user), 'INVALID_ARGUMENT');
  assert.equal(Object.keys((await adminRead(`chatRoom/users/${user.localId}`)).connections).length, 8);
});
