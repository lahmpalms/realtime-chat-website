import { test, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/);
async function write(path, value) {
  const response = await fetch(`http://${host}/${path}.json?ns=demo-realtime-chat-default-rtdb`, {
    method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(value),
  });
  expect(response.status).toBe(200);
}
const log = page => page.getByRole('log', { name: 'Chat messages' });
async function join(page) {
  await page.goto('/');
  await page.getByLabel('Your display name for the chat').fill('History guest');
  await page.getByRole('button', { name: 'Join Chat Room', exact: true }).click();
  await expect(page.getByText('Enter to send', { exact: true })).toBeVisible();
}
const fixture = (index, timestamp) => { const id = `seed-${String(index).padStart(4, '0')}`;
  return [id, { id, userId: 'fixture', userName: 'Earlier guest', userColor: '#3B82F6', text: `History ${index}`, timestamp }]; };
test.beforeEach(async () => write('', null));

test('history pages stay bounded, preserve the visible anchor and can reach all retained messages', async ({ page }) => {
  const now = Date.now() - 10_000;
  await write('chatMessages', Object.fromEntries(Array.from({ length: 325 }, (_, index) => fixture(index, now + index))));
  await join(page);
  await expect(log(page).getByRole('article')).toHaveCount(50);
  await expect(log(page).getByText('History 274', { exact: true })).toHaveCount(0);
  const older = page.getByRole('button', { name: 'Load earlier messages', exact: true });
  for (let index = 0; index < 6; index++) {
    await older.scrollIntoViewIfNeeded();
    const first = log(page).getByRole('article').first();
    const id = await first.getAttribute('data-message-id');
    const before = await first.boundingBox();
    await older.click();
    await expect(page.getByRole('button', { name: 'Loading earlier messages…' })).toHaveCount(0);
    const after = await page.locator(`[data-message-id="${id}"]`).boundingBox();
    expect(Math.abs(after.y - before.y)).toBeLessThan(3);
    expect(await log(page).getByRole('article').count()).toBeLessThanOrEqual(200);
  }
  await expect(log(page).getByText('History 0', { exact: true })).toHaveCount(1);
  await expect(older).toHaveCount(0);
  const [id, message] = fixture(999, Date.now());
  await write(`chatMessages/${id}`, message);
  const jump = page.getByRole('button', { name: '1 new · Jump to latest' });
  await expect(jump).toBeVisible();
  await expect(log(page).getByText('History 999', { exact: true })).toHaveCount(0);
  await jump.click();
  await expect(log(page).getByRole('article')).toHaveCount(50);
  await expect(log(page).getByText('History 999', { exact: true })).toBeVisible();
  await expect.poll(() => log(page).evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(3);
});

test('timestamp ties paginate by key without duplicates and history can return to the latest without incoming messages', async ({ page }) => {
  const timestamp = Date.now() - 1000;
  await write('chatMessages', Object.fromEntries(Array.from({ length: 120 }, (_, index) => fixture(index, timestamp))));
  await join(page);
  const older = page.getByRole('button', { name: 'Load earlier messages', exact: true });
  await older.click();
  await expect(log(page).getByRole('article')).toHaveCount(100);
  await older.click();
  await expect(log(page).getByRole('article')).toHaveCount(120);
  const ids = await log(page).getByRole('article').evaluateAll(elements => elements.map(element => element.dataset.messageId));
  expect(new Set(ids).size).toBe(120);
  expect(ids[0]).toBe('seed-0000');
  expect(ids.at(-1)).toBe('seed-0119');
  await page.getByRole('button', { name: 'Return to latest', exact: true }).click();
  await expect(log(page).getByRole('article')).toHaveCount(50);
  await expect(log(page).getByText('History 119', { exact: true })).toBeVisible();
  await expect(log(page)).toBeFocused();
});
