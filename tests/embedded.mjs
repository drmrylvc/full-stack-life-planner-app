import { chromium, expect } from '@playwright/test';

const url = process.env.TEST_BASE_URL;
if (!url?.startsWith('https://')) {
  console.log('Set TEST_BASE_URL to the HTTPS preview URL to test embedded sessions.');
  process.exit(0);
}
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1500, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('https://ezlife26-parent.example/**', (route) => route.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0"><iframe src="${url}" style="width:1440px;height:1050px;border:0" title="ezlife26 preview"></iframe></body></html>` }));
try {
  await page.goto('https://ezlife26-parent.example/');
  let app = page.frameLocator('iframe');
  await expect(app.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible({ timeout: 30000 });
  const saveResponse = page.waitForResponse((response) => response.url().includes('/api/items/habit/') && response.request().method() === 'PATCH');
  await app.getByRole('button', { name: 'Log Drink enough water', exact: true }).click();
  expect((await saveResponse).status()).toBe(200);
  await expect(app.locator('.snap-glance .ring-label strong')).toHaveText('100%');
  await page.reload();
  app = page.frameLocator('iframe');
  await expect(app.locator('.snap-glance .ring-label strong')).toHaveText('100%', { timeout: 30000 });
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.httpOnly && cookie.secure && cookie.sameSite === 'None' && cookie.partitionKey)).toBe(true);
  console.log('✓ Embedded HTTPS preview uses private partitioned sessions and persists changes');

  await app.locator('.planner-tools').getByRole('button', { name: 'Settings', exact: true }).click();
  await app.getByRole('button', { name: /Make this space yours/ }).click();
  let dialog = app.getByRole('dialog');
  const email = `embedded-${Date.now()}@example.com`;
  const password = 'ezlife26Embedded2026!';
  await dialog.getByLabel('Your name', { exact: true }).fill('Sky Taylor');
  await dialog.getByLabel('Email address', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Create my account', exact: true }).click();
  await expect(app.locator('.page-heading h1')).toContainText('Sky');
  await expect(app.locator('.snap-glance .ring-label strong')).toHaveText('100%');
  console.log('✓ Embedded sign-up preserves the demo workspace');

  await app.locator('.planner-tools').getByRole('button', { name: 'Settings', exact: true }).click();
  await app.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(app.getByRole('dialog').getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(await context.cookies()).toHaveLength(0);
  dialog = app.getByRole('dialog');
  await dialog.getByLabel('Email address', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in to ezlife26', exact: true }).click();
  await expect(app.locator('.page-heading h1')).toContainText('Sky');
  await expect(app.locator('.snap-glance .ring-label strong')).toHaveText('100%');
  expect(errors).toEqual([]);
  console.log('✓ Embedded sign-out clears the cookie; sign-in restores the saved workspace');
  console.log('All hosted preview regression checks passed.');
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
} finally { await browser.close(); }
