import { chromium, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
await mkdir('artifacts', { recursive: true });

try {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible();
  await expect(page.locator('.sidebar, .topbar, .sidebar-backdrop')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toBeVisible();
  await expect(page.locator('.snap-stack')).toContainText('Tasks');
  await expect(page.locator('body')).not.toContainText('Chores');
  const header = await page.locator('.page-heading.is-today').boundingBox();
  expect(header.y).toBe(0);
  await page.screenshot({ path: 'artifacts/planner-only-desktop.png', fullPage: true });
  console.log('✓ Desktop keeps the planner only: no sidebar or top toolbar');

  await page.getByRole('button', { name: 'Open my plan', exact: true }).click();
  const calendar = await page.locator('.week-calendar').boundingBox();
  const taskPanel = await page.locator('.tasks-under-calendar').boundingBox();
  expect(taskPanel.y).toBeGreaterThan(calendar.y + calendar.height);
  const label = `Phone task ${Date.now()}`;
  await page.locator('.tasks-under-calendar').getByRole('button', { name: 'Add a task', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add a task', exact: true })).toBeVisible();
  await dialog.getByLabel('Task', { exact: true }).fill(label);
  await dialog.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  let row = page.locator('.task-list article').filter({ hasText: label });
  await expect(row).toBeVisible();
  const saveTask = page.waitForResponse(response => response.url().includes('/api/items/chore/') && response.request().method() === 'PATCH');
  await row.getByRole('button', { name: `Complete ${label}`, exact: true }).click();
  await expect(row).toHaveClass('is-done');
  expect((await saveTask).status()).toBe(200);
  await page.reload({ waitUntil: 'networkidle' });
  row = page.locator('.task-list article').filter({ hasText: label });
  await expect(row).toHaveClass('is-done');
  await row.locator('button').filter({ hasText: label }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edit your task', exact: true })).toBeVisible();
  await dialog.getByLabel('Task', { exact: true }).fill(`${label} edited`);
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  row = page.locator('.task-list article').filter({ hasText: `${label} edited` });
  await row.getByRole('button', { name: 'Item actions', exact: true }).click();
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, delete it', exact: true }).click();
  await expect(page.locator('.task-list')).not.toContainText(label);
  console.log('✓ Tasks remain under the calendar, with persistent create, complete, edit and delete');

  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Today', exact: true }).click();
  for (const [option, text] of [['Türkçe', 'Görevler'], ['Français', 'Tâches'], ['Deutsch', 'Aufgaben'], ['中文', '任务'], ['Español', 'Tareas'], ['English', 'Tasks']]) {
    await page.getByRole('button', { name: 'Change language', exact: true }).click();
    await page.getByRole('option').filter({ hasText: option }).click();
    await expect(page.locator('.snap-stack')).toContainText(text);
  }
  console.log('✓ Task labels and the language selector work in all six languages');

  await page.getByRole('button', { name: 'Use on phone', exact: true }).click();
  dialog = page.getByRole('dialog');
  const originLink = `${new URL(baseURL).origin}/`;
  await expect(dialog.getByLabel('Mobile app link', { exact: true })).toHaveValue(originLink);
  await expect(dialog).toContainText('Android');
  await expect(dialog).toContainText('iPhone');
  await expect(dialog).toContainText('Add to Home Screen');
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(originLink);
  await page.screenshot({ path: 'artifacts/mobile-link-dialog.png' });
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  const manifest = await (await context.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  for (const asset of ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/sw.js']) {
    expect((await context.request.get(asset)).status()).toBe(200);
  }
  console.log('✓ Mobile link copies correctly; Android/iPhone install instructions and app assets work');

  for (const device of ['iPhone 13', 'Pixel 7']) {
    const phone = await browser.newContext({ ...devices[device], baseURL });
    const screen = await phone.newPage();
    screen.on('pageerror', error => errors.push(error.message));
    await screen.goto('/', { waitUntil: 'networkidle' });
    await expect(screen.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible();
    await expect(screen.locator('.sidebar, .topbar')).toHaveCount(0);
    await expect(screen.getByRole('navigation', { name: 'Main navigation', exact: true })).toBeVisible();
    for (const width of [320, 390, 768]) {
      await screen.setViewportSize({ width, height: 844 });
      expect(await screen.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    await screen.setViewportSize({ width: 390, height: 844 });
    await screen.screenshot({ path: `artifacts/planner-${device.replaceAll(' ', '-').toLowerCase()}.png`, fullPage: true });
    await phone.close();
  }
  expect(errors).toEqual([]);
  console.log('✓ iPhone and Android layouts are responsive with no browser errors');
  await context.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
