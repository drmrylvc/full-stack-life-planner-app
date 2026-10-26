import { chromium, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
await mkdir('artifacts', { recursive: true });
const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const workspace = async () => (await context.request.get('/api/workspace')).json();
const nav = name => page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name, exact: true });
const saveResponse = method => page.waitForResponse(response => response.url().includes('/api/items/target') && response.request().method() === method);
const suffix = Date.now();
const log = message => console.log(`✓ ${message}`);

try {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/ezlife26/);
  await expect(page.locator('.app-wordmark')).toHaveText('ezlife26');
  await nav('Targets').click();
  await page.evaluate(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Add a target', exact: true }).click();
  let dialog = page.getByRole('dialog');
  expect(await dialog.locator('.modal-header').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('gradient');
  const simpleTitle = `A target without a deadline ${suffix}`;
  await dialog.getByLabel('Your meaningful target', { exact: true }).fill(simpleTitle);
  await dialog.getByLabel('A gentle deadline', { exact: true }).fill('');
  const firstSave = saveResponse('POST');
  await dialog.getByRole('button', { name: 'Add target', exact: true }).click();
  expect((await firstSave).status()).toBe(201);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: simpleTitle, exact: true })).toBeVisible();
  let data = await workspace();
  const simple = data.items.find(item => item.title === simpleTitle);
  expect(simple.areaId).toBeNull();
  expect(simple.data.dueDate).toBeUndefined();
  await context.request.delete(`/api/items/target/${simple.id}`);
  log('New targets save with no area/date and without crypto.randomUUID, and survive reload');

  const emptyFields = await context.request.post('/api/items/target', { data: { title: 'Optional fields', areaId: '', data: { dueDate: '', time: '' } } });
  expect(emptyFields.status(), await emptyFields.text()).toBe(201);
  const empty = await emptyFields.json();
  expect(empty.areaId).toBeNull();
  await context.request.delete(`/api/items/target/${empty.id}`);

  await page.getByRole('button', { name: 'Add a target', exact: true }).click();
  dialog = page.getByRole('dialog');
  const retryTitle = `Retry without losing my form ${suffix}`;
  await dialog.getByLabel('Your meaningful target', { exact: true }).fill(retryTitle);
  await page.route('**/api/items/target', route => route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary test failure. Please retry.' }) }) : route.continue());
  await dialog.getByRole('button', { name: 'Add target', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Temporary test failure');
  await expect(dialog.getByLabel('Your meaningful target', { exact: true })).toHaveValue(retryTitle);
  expect((await workspace()).items.filter(item => item.title === retryTitle)).toHaveLength(0);
  await page.unroute('**/api/items/target');
  const retrySave = saveResponse('POST');
  await dialog.getByRole('button', { name: 'Add target', exact: true }).click();
  expect((await retrySave).status()).toBe(201);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  data = await workspace();
  expect(data.items.filter(item => item.title === retryTitle)).toHaveLength(1);
  await context.request.delete(`/api/items/target/${data.items.find(item => item.title === retryTitle).id}`);
  log('Failed saves roll back optimistically, preserve the form, and can be retried');

  const seriesTitle = `Monthly reading review ${suffix}`;
  await page.getByRole('button', { name: 'Add a target', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your meaningful target', { exact: true }).fill(seriesTitle);
  await dialog.getByLabel('A gentle deadline', { exact: true }).fill('2026-01-31');
  await dialog.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('monthly');
  await dialog.getByRole('spinbutton', { name: 'Number of repeats', exact: true }).fill('3');
  await expect(dialog.locator('.repeat-settings-heading')).toContainText('4 occurrences');
  await expect(dialog.locator('.repeat-date-preview')).toContainText('28 Feb 2026');
  await expect(dialog.locator('.repeat-date-preview')).toContainText('31 Mar 2026');
  await page.screenshot({ path: 'artifacts/ezlife26-target-editor.png' });
  const seriesSave = saveResponse('POST');
  await dialog.getByRole('button', { name: 'Add target', exact: true }).click();
  expect((await seriesSave).status()).toBe(201);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.target-card').filter({ hasText: seriesTitle })).toHaveCount(4);
  await page.reload({ waitUntil: 'networkidle' });
  data = await workspace();
  let series = data.items.filter(item => item.title === seriesTitle).sort((a, b) => a.data.repeatIndex - b.data.repeatIndex);
  expect(series.map(item => item.data.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  expect(new Set(series.map(item => item.data.seriesId)).size).toBe(1);
  expect(series.every(item => item.data.repeatCount === 3)).toBe(true);
  log('Monthly repeat preview and all dated occurrences persist without month-end drift');

  let firstCard = page.locator('.target-card').filter({ hasText: seriesTitle }).filter({ hasText: 'Monthly · 1/4' });
  await firstCard.getByRole('button', { name: seriesTitle, exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('spinbutton', { name: 'Number of repeats', exact: true })).toHaveValue('3');
  await dialog.getByRole('slider').press('End');
  const completeSave = saveResponse('PATCH');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await completeSave).status()).toBe(200);
  data = await workspace();
  series = data.items.filter(item => item.title === seriesTitle).sort((a, b) => a.data.repeatIndex - b.data.repeatIndex);
  expect(series).toHaveLength(4);
  expect(series[0].data.progress).toBe(100);
  expect(series.slice(1).every(item => item.data.progress === 0)).toBe(true);

  firstCard = page.locator('.target-card').filter({ hasText: seriesTitle }).filter({ hasText: 'Monthly · 1/4' });
  await firstCard.getByRole('button', { name: seriesTitle, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
  await dialog.getByRole('spinbutton', { name: 'Number of repeats', exact: true }).fill('2');
  const reschedule = saveResponse('PATCH');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await reschedule).status()).toBe(200);
  await expect(page.locator('.target-card').filter({ hasText: seriesTitle })).toHaveCount(3);
  data = await workspace();
  series = data.items.filter(item => item.title === seriesTitle).sort((a, b) => a.data.repeatIndex - b.data.repeatIndex);
  expect(series.map(item => item.data.dueDate)).toEqual(['2026-01-31', '2026-02-07', '2026-02-14']);
  firstCard = page.locator('.target-card').filter({ hasText: seriesTitle }).filter({ hasText: 'Weekly · 1/3' });
  await firstCard.getByRole('button', { name: 'Item actions', exact: true }).click();
  await firstCard.getByRole('button', { name: 'Delete', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Also delete all other occurrences in this series', exact: true }).check();
  await dialog.getByRole('button', { name: 'Yes, delete it', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await workspace()).items.filter(item => item.title === seriesTitle)).toHaveLength(0);
  log('Occurrence completion, series rescheduling, and whole-series deletion work');

  const cases = [
    ['target', 'daily', '2026-03-07', ['2026-03-07', '2026-03-08', '2026-03-09']],
    ['plan', 'weekly', '2026-12-25', ['2026-12-25', '2027-01-01', '2027-01-08']],
    ['chore', 'monthly', '2026-01-31', ['2026-01-31', '2026-02-28', '2026-03-31']],
    ['target', 'yearly', '2024-02-29', ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']],
  ];
  for (const [kind, repeat, start, expected] of cases) {
    const inputData = { repeat, repeatCount: expected.length - 1, ...(kind === 'target' ? { dueDate: start } : { date: start }), ...(kind === 'plan' ? { time: '11:00', duration: 30 } : {}) };
    const response = await context.request.post(`/api/items/${kind}`, { data: { title: `${repeat} API check ${suffix}`, areaId: null, data: inputData } });
    expect(response.status(), await response.text()).toBe(201);
    const created = await response.json();
    expect(created.occurrences.map(item => kind === 'target' ? item.data.dueDate : item.data.date)).toEqual(expected);
    for (const occurrence of created.occurrences) {
      expect((await context.request.get(`/api/items/${kind}/${occurrence.id}`)).status()).toBe(200);
    }
    const deletion = await context.request.delete(`/api/items/${kind}/${created.id}?series=1`);
    expect(deletion.status()).toBe(200);
    expect((await deletion.json()).removedIds).toHaveLength(expected.length);
  }
  for (const repeatCount of [-1, 366, 2.5]) {
    expect((await context.request.post('/api/items/target', { data: { title: 'Bad repeat', data: { repeat: 'daily', repeatCount } } })).status()).toBe(400);
  }
  const zero = await context.request.post('/api/items/target', { data: { title: 'Zero repeats', data: { repeat: 'daily', repeatCount: 0 } } });
  expect(zero.status()).toBe(201);
  const zeroSaved = await zero.json();
  expect(zeroSaved.occurrences).toHaveLength(1);
  await context.request.delete(`/api/items/target/${zeroSaved.id}`);
  log('Daily, weekly, monthly, yearly, leap-year dates and repeat-count validation pass');

  await page.goto('/?view=plan', { waitUntil: 'networkidle' });
  data = await workspace();
  const taskDay = data.items.find(item => item.kind === 'plan').data.date;
  const taskResponse = await context.request.post('/api/items/chore', { data: { title: `Calendar repeats ${suffix}`, data: { date: taskDay, repeat: 'daily', repeatCount: 2 } } });
  const task = await taskResponse.json();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByLabel('Choose a day', { exact: true }).fill(task.occurrences[1].data.date);
  await expect(page.locator('.task-list')).toContainText(`Calendar repeats ${suffix}`);
  await context.request.delete(`/api/items/chore/${task.id}?series=1`);
  log('Repeated tasks appear on their individual dates under the calendar');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('.snap-area').filter({ hasText: 'Feed your mind' }).click();
  expect(await page.locator('.area-detail-banner').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('gradient');
  await page.screenshot({ path: 'artifacts/ezlife26-area-detail.png', fullPage: true });

  for (const device of ['iPhone 13', 'Pixel 7']) {
    const phone = await browser.newContext({ ...devices[device], baseURL, ignoreHTTPSErrors: true });
    const screen = await phone.newPage();
    screen.on('pageerror', error => errors.push(error.message));
    await screen.goto('/', { waitUntil: 'networkidle' });
    await screen.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Targets', exact: true }).click();
    await screen.getByRole('button', { name: 'Add a target', exact: true }).click();
    await screen.getByRole('dialog').getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('yearly');
    for (const width of [320, 390, 768]) {
      await screen.setViewportSize({ width, height: 844 });
      expect(await screen.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(await screen.getByRole('dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    await screen.setViewportSize({ width: 390, height: 844 });
    await screen.screenshot({ path: `artifacts/ezlife26-${device.replaceAll(' ', '-').toLowerCase()}-editor.png` });
    await phone.close();
  }
  expect(errors).toEqual([]);
  log('Renamed app, matching detail/editor themes and phone/tablet layouts pass without runtime errors');
} catch (error) {
  await page.screenshot({ path: 'artifacts/repeats-failure.png', fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
