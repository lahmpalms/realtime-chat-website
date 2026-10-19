import { test, expect } from '@playwright/test';
import assert from 'node:assert/strict';
assert.ok(process.env.FIREBASE_DATABASE_EMULATOR_HOST, 'Run with npm run test:phase2');
const root = `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`;
async function data(path = '') {
  const response = await fetch(`${root}/${path}.json?ns=demo-realtime-chat-default-rtdb`, { headers: { Authorization: 'Bearer owner' } });
  expect(response.status).toBe(200);
  return response.json();
}
const connections = async uid => Object.keys(await data(`chatRoom/users/${uid}/connections`) || {});
async function profile() { return Object.values(await data('chatRoom/users') || {})[0]; }
async function ready(page) { await expect(page.getByText('Enter to send', { exact: true })).toBeVisible(); }
async function join(page, name = 'Alice') {
  await page.goto('/');
  await page.getByLabel('Your display name for the chat').fill(name);
  await page.getByRole('button', { name: 'Join Chat Room', exact: true }).click();
  await ready(page);
}
const input = page => page.getByRole('textbox', { name: 'Message', exact: true });
const sendButton = page => page.getByRole('button', { name: /^(Send message|Retry message)$/ });
test.beforeEach(async () => {
  const response = await fetch(`${root}/.json?ns=demo-realtime-chat-default-rtdb`, {
    method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: 'null',
  });
  expect(response.status).toBe(200);
});

test('leaving and closing individual tabs preserves the remaining tab', async ({ page, context }) => {
  await join(page);
  const uid = (await profile()).id;
  const second = await context.newPage();
  await join(second);
  const third = await context.newPage();
  await join(third);
  await expect.poll(async () => (await connections(uid)).length).toBe(3);
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Join Chat Room', exact: true })).toBeVisible();
  await expect.poll(async () => (await connections(uid)).length).toBe(2);
  await second.close();
  await expect.poll(async () => (await connections(uid)).length).toBe(1);
  await input(third).fill('Remaining tab works');
  await sendButton(third).click();
  await expect(input(third)).toHaveValue('');
  await expect.poll(async () => Object.values(await data('chatMessages') || {}).map(message => message.text)).toEqual(['Remaining tab works']);
});

test('offline editing, reconnect and refresh preserve identity and unsent draft', async ({ page, context }) => {
  await join(page);
  const original = await profile();
  const old = await connections(original.id);
  const joins = [];
  page.on('request', request => { if (request.url().endsWith('/joinRoom') && request.method() === 'POST') joins.push(request.postDataJSON().data); });
  await input(page).fill('Draft before network loss');
  await context.setOffline(true);
  await expect(page.getByText('Offline or reconnecting. You can keep writing.', { exact: true })).toBeVisible();
  await input(page).fill('Draft written offline');
  await expect(sendButton(page)).toBeDisabled();
  await context.setOffline(false);
  await ready(page);
  await expect(input(page)).toHaveValue('Draft written offline');
  await page.reload();
  await ready(page);
  await expect(input(page)).toHaveValue('Draft written offline');
  await expect.poll(async () => (await connections(original.id)).length).toBe(1).catch(async error => { console.log(JSON.stringify({ old, joins, users: await data('chatRoom/users') })); throw error; });
  expect((await profile()).color).toBe(original.color);
  expect((await connections(original.id))[0]).not.toBe(old[0]);
  await sendButton(page).click();
  await expect(input(page)).toHaveValue('');
  expect(Object.values(await data('chatMessages')).map(message => message.text)).toEqual(['Draft written offline']);
});

test('lost acknowledgement and reload retry reuse the request ID and persist only once', async ({ page }) => {
  await join(page);
  let first = true;
  const requests = [];
  await page.route('**/us-central1/sendMessage', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    requests.push(route.request().postDataJSON().data);
    if (first) {
      first = false;
      await route.fetch(); // The server has committed; lose only its response.
      await route.abort('failed');
    } else await route.continue();
  });
  await input(page).fill('Confirm this message');
  await sendButton(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Your draft is saved' })).toBeVisible();
  await expect(input(page)).toHaveValue('Confirm this message');
  await page.reload();
  await ready(page);
  await expect(input(page)).toHaveValue('Confirm this message');
  await sendButton(page).click();
  await expect(input(page)).toHaveValue('');
  expect(requests.length).toBe(2);
  expect(requests[1].requestId).toBe(requests[0].requestId);
  expect(Object.keys(await data('chatMessages'))).toHaveLength(1);
  const uid = (await profile()).id;
  expect((await data(`chatRoom/rateLimits/${uid}/messages`))).toHaveLength(1);
});

test('leaving during a delayed session restore cannot resurrect that tab', async ({ page }) => {
  await join(page);
  const uid = (await profile()).id;
  let unblock;
  let started;
  let finished;
  const gate = new Promise(resolve => { unblock = resolve; });
  const admitted = new Promise(resolve => { started = resolve; });
  const fulfilled = new Promise(resolve => { finished = resolve; });
  await page.route('**/us-central1/joinRoom', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
    finished();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await admitted;
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  unblock();
  await fulfilled;
  await expect(page.getByRole('button', { name: 'Join Chat Room', exact: true })).toBeVisible();
  await expect.poll(async () => (await connections(uid)).length).toBe(0);
  await expect(input(page)).toHaveCount(0);
});

test('two immediate submits share a single in-flight request', async ({ page }) => {
  await join(page);
  let unblock;
  let started;
  const gate = new Promise(resolve => { unblock = resolve; });
  const pending = new Promise(resolve => { started = resolve; });
  let count = 0;
  await page.route('**/us-central1/sendMessage', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    count++;
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await input(page).fill('One in flight');
    await page.getByRole('form', { name: 'Send a message' }).evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await pending;
    await expect(input(page)).toHaveAttribute('readonly', '');
    await expect(sendButton(page)).toBeDisabled();
    expect(count).toBe(1);
  } finally { unblock(); }
  await expect(input(page)).toHaveValue('');
  expect(Object.keys(await data('chatMessages'))).toHaveLength(1);
});

test('quota feedback keeps the draft and enables the same request after cooldown', async ({ page }) => {
  await join(page);
  const requests = [];
  await page.route('**/us-central1/sendMessage', async route => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    requests.push(route.request().postDataJSON().data);
    if (requests.length === 1) {
      await route.fulfill({ status: 429, contentType: 'application/json',
        headers: { 'access-control-allow-origin': 'http://127.0.0.1:3189' },
        body: JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Please wait', details: { retryAfterMs: 1500 } } }),
      });
    } else await route.continue();
  });
  await input(page).fill('After cooldown');
  await sendButton(page).click();
  await expect(page.getByText(/Retry in [12]s/)).toBeVisible();
  await expect(sendButton(page)).toBeDisabled();
  await expect(input(page)).toHaveValue('After cooldown');
  await expect(sendButton(page)).toBeEnabled();
  await sendButton(page).click();
  await expect(input(page)).toHaveValue('');
  expect(requests[1].requestId).toBe(requests[0].requestId);
  expect(Object.keys(await data('chatMessages'))).toHaveLength(1);
});

test('an old send acknowledgement cannot erase a new draft after leaving and rejoining', async ({ page }) => {
  await join(page);
  let unblock;
  let started;
  const gate = new Promise(resolve => { unblock = resolve; });
  const committed = new Promise(resolve => { started = resolve; });
  let first = true;
  await page.route('**/us-central1/sendMessage', async route => {
    if (route.request().method() === 'OPTIONS' || !first) return route.continue();
    first = false;
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await input(page).fill('Older send');
    await sendButton(page).click();
    await committed;
    await page.getByRole('button', { name: 'Leave', exact: true }).click();
    await page.getByLabel('Your display name for the chat').fill('Alice');
    await page.getByRole('button', { name: 'Join Chat Room', exact: true }).click();
    await ready(page);
    await input(page).fill('New unsent draft');
    const delivered = page.waitForResponse(response => response.url().endsWith('/sendMessage') && response.status() === 200);
    unblock();
    await (await delivered).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.reload();
    await ready(page);
    await expect(input(page)).toHaveValue('New unsent draft');
    expect(Object.values(await data('chatMessages')).map(message => message.text)).toEqual(['Older send']);
  } finally { unblock(); }
});
