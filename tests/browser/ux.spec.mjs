import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';

const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Use the local Firebase emulator');
const root = `http://${host}`;
async function write(path, value) {
  const response = await fetch(`${root}/${path}.json?ns=demo-realtime-chat-default-rtdb`, {
    method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(value),
  });
  expect(response.status).toBe(200);
}
async function read(path) {
  const response = await fetch(`${root}/${path}.json?ns=demo-realtime-chat-default-rtdb`, { headers: { Authorization: 'Bearer owner' } });
  expect(response.status).toBe(200);
  return response.json();
}
const input = page => page.getByRole('textbox', { name: 'Message', exact: true });
const log = page => page.getByRole('log', { name: 'Chat messages' });
const message = (id, text, timestamp = Date.now()) => ({ id, userId: 'fixture-sender', userName: 'เพื่อน', userColor: '#facc15', text, timestamp });
async function ready(page) { await expect(page.getByText('Enter to send', { exact: true })).toBeVisible(); }
async function join(page, name = 'น้องฟ้า') {
  await page.goto('/');
  await page.getByLabel('Your display name for the chat').fill(name);
  await page.getByRole('button', { name: 'Join Chat Room', exact: true }).click();
  await ready(page);
}
async function pinned(page) {
  await expect.poll(() => log(page).evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(3);
}
async function accessible(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
}
test.beforeEach(async () => write('', null));

test('Thai names, native form validation and multiline IME-safe sending', async ({ page }) => {
  await page.goto('/');
  const name = page.getByLabel('Your display name for the chat');
  await page.getByRole('button', { name: 'Join Chat Room', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please enter your display name.' })).toHaveText('Please enter your display name.');
  await expect(name).toBeFocused();
  await name.fill('น้องฟ้า');
  await name.press('Escape');
  await expect(name).toHaveValue('น้องฟ้า');
  let joins = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/joinRoom')) joins++; });
  await name.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true });
  await expect(name).toBeVisible();
  expect(joins).toBe(0);
  await name.press('Enter');
  await ready(page);
  expect(joins).toBe(1);
  expect(Object.values(await read('chatRoom/users'))[0].name).toBe('น้องฟ้า');
  await input(page).fill('สวัสดี');
  await input(page).dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true });
  expect(await read('chatMessages')).toBeNull();
  await input(page).press('End');
  await input(page).press('Shift+Enter');
  await input(page).pressSequentially('hello');
  await expect(input(page)).toHaveValue('สวัสดี\nhello');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toBeFocused();
  expect(Object.values(await read('chatMessages')).map(item => item.text)).toEqual(['สวัสดี\nhello']);
});

test('join failures stay inline and preserve the name for retry', async ({ page }) => {
  let fail = true;
  await page.route('**/us-central1/joinRoom', async route => {
    if (route.request().method() === 'OPTIONS' || !fail) return route.continue();
    fail = false;
    await route.fulfill({ status: 429, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Room is full' } }) });
  });
  await page.goto('/');
  const name = page.getByLabel('Your display name for the chat');
  await name.fill('น้องฟ้า');
  await name.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'room is full' })).toContainText('room is full');
  await expect(name).toHaveValue('น้องฟ้า');
  await page.getByRole('button', { name: 'Join Chat Room', exact: true }).click();
  await ready(page);
});

test('history opens at the bottom; reading earlier messages is preserved until jumping or sending', async ({ page }) => {
  const history = Object.fromEntries(Array.from({ length: 45 }, (_, index) => {
    const id = `seed-${index}`;
    return [id, message(id, `Earlier message ${index}\nSecond line`, Date.now() - 100_000 + index * 1000)];
  }));
  await write('chatMessages', history);
  await join(page);
  await expect(log(page)).toHaveCount(1);
  await expect(log(page).getByRole('article')).toHaveCount(45);
  await pinned(page);
  await log(page).evaluate(element => { element.scrollTop = 0; });
  await expect.poll(() => log(page).evaluate(element => element.scrollTop)).toBe(0);
  await write('chatMessages/new-incoming', message('new-incoming', 'A new incoming message'));
  const jump = page.getByRole('button', { name: /1 new · Jump to latest/ });
  await expect(jump).toBeVisible();
  expect(await log(page).evaluate(element => element.scrollTop)).toBe(0);
  await jump.click();
  await pinned(page);
  await expect(jump).not.toBeVisible();
  await expect(log(page)).toBeFocused();
  await log(page).evaluate(element => { element.scrollTop = 0; });
  await input(page).fill('My reply from history');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('');
  await pinned(page);
  await page.setViewportSize({ width: 390, height: 360 });
  await pinned(page);
});

test('small mobile, landscape and keyboard-sized viewports keep the composer visible without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await write('chatMessages/long', message('long', 'ก'.repeat(300) + '\n' + 'x'.repeat(180)));
  await join(page);
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 360 }]) {
    await page.setViewportSize(viewport);
    await input(page).fill('first line\nsecond line\nthird line');
    await expect.poll(async () => {
      const box = await input(page).boundingBox();
      return !!box && box.y >= 0 && box.y + box.height <= viewport.height;
    }).toBe(true);
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      height: innerHeight, docHeight: document.documentElement.scrollHeight }));
    if (viewport.width === 320) await page.screenshot({ path: testInfo.outputPath('mobile.png') });
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
    expect(metrics.docHeight).toBeLessThanOrEqual(metrics.height + 1);
    expect(await log(page).evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await input(page).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    for (const button of [page.getByRole('button', { name: 'Leave', exact: true }), page.getByRole('button', { name: 'Toggle theme' }), page.getByRole('button', { name: 'Open emoji picker' }), page.getByRole('button', { name: 'Send message', exact: true })]) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  }
});

test('keyboard focus, emoji focus restoration and automated accessibility in light and dark themes', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByLabel('Your display name for the chat')).toBeVisible();
  // WebKit on macOS uses Option+Tab to include buttons in keyboard navigation.
  const nextControl = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(nextControl);
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeFocused();
  await page.keyboard.press(nextControl);
  await expect(page.getByLabel('Your display name for the chat')).toBeFocused();
  await accessible(page);
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await accessible(page);
  await page.getByLabel('Your display name for the chat').fill('น้องฟ้า');
  await page.getByLabel('Your display name for the chat').press('Enter');
  await ready(page);
  await write('chatMessages/contrast', message('contrast', 'Readable text with a bright identity color'));
  await expect(log(page).getByRole('article')).toHaveCount(1);
  await accessible(page);
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await accessible(page);
  const trigger = page.getByRole('button', { name: 'Open emoji picker' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Choose an emoji' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button').first()).toBeFocused();
  await accessible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Select emoji 😀', exact: true }).click();
  await expect(input(page)).toHaveValue('😀');
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 320, height: 568 });
  await trigger.click();
  await accessible(page);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});
