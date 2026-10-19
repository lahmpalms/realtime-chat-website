import { test, expect } from '@playwright/test';

test('production serves the chat with browser security headers and hides the development preview', async ({ page, request }) => {
  test.skip(process.env.CHAT_TEST_PRODUCTION !== 'true', 'Production build verification only');
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['permissions-policy']).toContain('microphone=()');
  expect(headers['x-powered-by']).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Join Chat Room', exact: true })).toBeVisible();
  const preview = await request.get('/test');
  expect(preview.status()).toBe(404);
});
