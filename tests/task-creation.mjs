import { chromium, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
await mkdir('artifacts', { recursive: true });
const errors = [];
const log = message => console.log(`✓ ${message}`);
const localDay = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

try {
  for (const device of ['iPhone 13', 'Pixel 7']) {
    const context = await browser.newContext({ ...devices[device], baseURL, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible();
    const nav = name => page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name, exact: true });
    const workspace = async () => (await context.request.get('/api/workspace')).json();
    const responseFor = method => page.waitForResponse(response => response.url().includes('/api/items/chore') && response.request().method() === method);
    const visibleSave = async dialog => {
      const box = await dialog.getByRole('button', { name: 'Add task', exact: true }).boundingBox();
      expect(box).not.toBeNull();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    };

    // The actual touch flow from the large center +, not just a direct API call.
    await nav('Add anything').tap();
    await page.getByRole('button', { name: 'A task A to-do under your calendar', exact: true }).tap();
    let dialog = page.getByRole('dialog');
    const title = `Phone task ${device} ${Date.now()}`;
    await dialog.getByLabel('Task', { exact: true }).fill(title);
    await dialog.getByLabel('Day on the calendar', { exact: true }).fill('');
    await visibleSave(dialog);
    await page.screenshot({ path: `artifacts/task-add-${device.replaceAll(' ', '-').toLowerCase()}.png` });
    const save = responseFor('POST');
    await dialog.getByRole('button', { name: 'Add task', exact: true }).tap();
    expect((await save).status()).toBe(201);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.snap-row').filter({ hasText: title })).toBeVisible();
    let saved = (await workspace()).items.find(item => item.title === title);
    expect(saved).toBeDefined();
    expect(saved.areaId).toBeNull();
    expect(saved.data.date).toBe(localDay());
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.snap-row').filter({ hasText: title })).toBeVisible();
    await context.request.delete(`/api/items/chore/${saved.id}`);
    log(`${device}: a title-only task saves with an empty date and survives refresh`);

    // The advanced form still keeps its save action on screen, even above a keyboard.
    await page.locator('.snap-card').filter({ hasText: 'Your to-do list under the calendar' }).getByRole('button', { name: 'Add a task', exact: true }).last().tap();
    dialog = page.getByRole('dialog');
    const scheduled = `Scheduled phone task ${device} ${Date.now()}`;
    await dialog.getByLabel('Task', { exact: true }).fill(scheduled);
    await dialog.getByLabel('Day on the calendar', { exact: true }).fill('2027-02-01');
    await dialog.getByRole('button', { name: 'Options & repeats', exact: true }).tap();
    await dialog.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
    await dialog.getByRole('spinbutton', { name: 'Number of repeats', exact: true }).fill('2');
    const width = page.viewportSize().width;
    await page.setViewportSize({ width, height: 430 });
    await page.waitForTimeout(150);
    await visibleSave(dialog);
    const repeatingSave = responseFor('POST');
    await dialog.getByRole('button', { name: 'Add task', exact: true }).tap();
    expect((await repeatingSave).status()).toBe(201);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.snap-row').filter({ hasText: scheduled })).toBeVisible();
    expect((await workspace()).items.filter(item => item.title === scheduled).map(item => item.data.date).sort()).toEqual(['2027-02-01', '2027-02-08', '2027-02-15']);
    saved = (await workspace()).items.find(item => item.title === scheduled && item.data.repeatIndex === 0);
    await context.request.delete(`/api/items/chore/${saved.id}?series=1`);
    log(`${device}: save stays visible on a short screen; repeats save and the selected day updates`);

    await page.setViewportSize({ width, height: 844 });
    await nav('Today').tap();
    await page.getByRole('button', { name: 'Open my plan', exact: true }).tap();
    await page.locator('.tasks-under-calendar').getByRole('button', { name: 'Add a task', exact: true }).tap();
    dialog = page.getByRole('dialog');
    const retryTitle = `Retry task ${device} ${Date.now()}`;
    await dialog.getByLabel('Task', { exact: true }).fill(retryTitle);
    await page.route('**/api/items/chore', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary test save failure.' }) }) : route.continue());
    await dialog.getByRole('button', { name: 'Add task', exact: true }).tap();
    await expect(dialog.getByRole('alert')).toContainText('Temporary test save failure');
    await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue(retryTitle);
    expect((await workspace()).items.filter(item => item.title === retryTitle)).toHaveLength(0);
    await page.unroute('**/api/items/chore');
    const retry = responseFor('POST');
    await dialog.getByRole('button', { name: 'Add task', exact: true }).tap();
    expect((await retry).status()).toBe(201);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.task-list')).toContainText(retryTitle);
    const records = (await workspace()).items.filter(item => item.title === retryTitle);
    expect(records).toHaveLength(1);
    await context.request.delete(`/api/items/chore/${records[0].id}`);
    log(`${device}: calendar task creation retains the form on errors and succeeds on retry`);

    await page.getByRole('button', { name: 'Use on phone', exact: true }).tap();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Mobile app link', { exact: true })).toHaveValue(`${new URL(baseURL).origin}/`);
    await expect(dialog.getByRole('link', { name: 'Open app', exact: true })).toHaveAttribute('href', `${new URL(baseURL).origin}/`);
    await expect(dialog).toContainText('Add to Home Screen');
    await context.close();
  }
  expect(errors).toEqual([]);
  log('Phone link and installation guidance work; no browser runtime errors');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
