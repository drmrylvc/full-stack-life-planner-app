import { chromium, devices, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
const log = (message) => console.log(`✓ ${message}`);
await mkdir('artifacts', { recursive: true });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', (error) => failures.push(error.message));
const nav = (name) => page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name });
const getWorkspace = async () => (await context.request.get('/api/workspace')).json();

try {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  let workspace = await getWorkspace();
  expect(workspace.areas).toHaveLength(6);
  expect(workspace.items.filter((item) => item.kind === 'target')).toHaveLength(13);
  expect(workspace.items.filter((item) => item.kind === 'habit')).toHaveLength(4);
  expect(workspace.items.filter((item) => item.kind === 'file')).toHaveLength(3);
  log('Personal demo workspace seeded with realistic data');

  await page.getByRole('button', { name: 'Log Drink enough water', exact: true }).click();
  await expect(page.locator('.snap-glance .ring-label strong')).toHaveText('100%');
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.snap-glance .ring-label strong')).toHaveText('100%');
  await page.getByRole('button', { name: 'Undo Drink enough water', exact: true }).click();
  await expect(page.locator('.snap-glance .ring-label strong')).toHaveText('75%');
  log('Optimistic habit check-ins persist across reloads');

  await nav(/^Targets$/).click();
  await page.getByRole('button', { name: 'Add a target', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your meaningful target', { exact: true }).fill('Train for a mountain hike');
  await dialog.getByRole('combobox').first().selectOption(workspace.areas.find((area) => area.name === 'Body').id);
  await dialog.getByLabel(/A little more detail/).fill('Build strength and enjoy the view.');
  await dialog.getByRole('button', { name: 'Add target', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Train for a mountain hike', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Train for a mountain hike', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('slider').focus();
  await dialog.getByRole('slider').press('End');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  workspace = await getWorkspace();
  expect(workspace.items.find((item) => item.title === 'Train for a mountain hike').data.progress).toBe(100);
  const targetCard = page.locator('.target-card').filter({ hasText: 'Train for a mountain hike' });
  await targetCard.getByRole('button', { name: 'Item actions', exact: true }).click();
  await targetCard.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete it', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Train for a mountain hike', exact: true })).toHaveCount(0);
  log('Target create, read, edit, and delete work through the UI');

  const today = workspace.items.find((item) => item.kind === 'plan').data.date;
  const cases = [
    ['plan', { date: today, time: '12:00', duration: 30, completed: false }],
    ['habit', { unit: '10 minutes', history: [] }],
    ['chore', { date: today, completed: false, description: 'Take the bins out.' }],
    ['note', { description: 'A real persistent thought.', pinned: true }],
    ['file', { content: `data:text/plain;base64,${Buffer.from('A real stored file.').toString('base64')}`, mimeType: 'text/plain', fileSize: 19 }],
  ];
  for (const [kind, data] of cases) {
    const createdResponse = await context.request.post(`/api/items/${kind}`, { data: { title: `Smoke ${kind}`, areaId: workspace.areas[0].id, data } });
    expect(createdResponse.status(), await createdResponse.text()).toBe(201);
    const created = await createdResponse.json();
    const readResponse = await context.request.get(`/api/items/${kind}/${created.id}`);
    expect(readResponse.status()).toBe(200);
    const updatedResponse = await context.request.patch(`/api/items/${kind}/${created.id}`, { data: { title: `Updated ${kind}`, data: { description: 'Saved and updated.' } } });
    expect(updatedResponse.status()).toBe(200);
    expect((await updatedResponse.json()).title).toBe(`Updated ${kind}`);
    if (kind === 'file') {
      const download = await context.request.get(`/api/files/${created.id}`);
      expect(download.status()).toBe(200);
      expect(await download.text()).toBe('A real stored file.');
    }
    const deleted = await context.request.delete(`/api/items/${kind}/${created.id}`);
    expect(deleted.status()).toBe(200);
    expect((await context.request.get(`/api/items/${kind}/${created.id}`)).status()).toBe(404);
  }
  log('Full persistent CRUD and authenticated downloads for every resource');

  const replacedResponse = await context.request.post('/api/items/file', { data: { title: 'Replace me.jpg', areaId: null, data: { url: '/images/family-picnic.jpg', mimeType: 'image/jpeg', fileSize: 100 } } });
  const replaced = await replacedResponse.json();
  const replacedUpdate = await context.request.patch(`/api/items/file/${replaced.id}`, { data: { title: 'Replaced.txt', data: { content: `data:text/plain;base64,${Buffer.from('New file content').toString('base64')}`, mimeType: 'text/plain', fileSize: 16 } } });
  expect((await replacedUpdate.json()).data.url).toBeUndefined();
  expect(await (await context.request.get(`/api/files/${replaced.id}`)).text()).toBe('New file content');
  await context.request.delete(`/api/items/file/${replaced.id}`);
  const invalid = await context.request.post('/api/items/target', { data: { title: 'Invalid', areaId: null, data: { progress: 150 } } });
  expect(invalid.status()).toBe(400);
  const csrf = await context.request.post('/api/items/note', { headers: { Origin: 'https://untrusted.example' }, data: { title: 'Blocked', areaId: null, data: {} } });
  expect(csrf.status()).toBe(403);
  log('Input validation, safe file replacement, and same-origin protection');

  const other = await browser.newContext({ baseURL });
  const otherData = await (await other.request.get('/api/workspace')).json();
  expect(otherData.user.id).not.toBe(workspace.user.id);
  const privateId = workspace.items.find((item) => item.kind === 'target').id;
  expect((await other.request.get(`/api/items/target/${privateId}`)).status()).toBe(404);
  expect((await other.request.patch(`/api/items/target/${privateId}`, { data: { title: 'Forbidden' } })).status()).toBe(404);
  const noSession = await browser.newContext({ baseURL });
  expect((await noSession.request.post('/api/items/note', { data: { title: 'No session', areaId: null, data: {} } })).status()).toBe(401);
  await noSession.close(); await other.close();
  log('Workspaces are isolated and unauthenticated writes are rejected');

  await nav(/^Files/).click();
  await page.getByRole('button', { name: 'Upload a file', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'Check-in.txt', mimeType: 'text/plain', buffer: Buffer.from('One small step, every day.') });
  await expect(dialog.getByLabel('File name', { exact: true })).toHaveValue('Check-in.txt');
  await dialog.getByRole('button', { name: 'Add file', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check-in.txt', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('pre')).toContainText('One small step, every day.');
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Download file', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('Check-in.txt');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete it', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check-in.txt', exact: true })).toHaveCount(0);
  log('Real file upload, preview, download, and delete work through the UI');

  await nav(/^Areas$/).click();
  await page.getByRole('button', { name: 'New life area', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Life area name', { exact: true }).fill('Creativity');
  await dialog.getByLabel(/^A little reminder/).fill('Make something just for you.');
  await dialog.getByRole('button', { name: 'Choose 🎨', exact: true }).click();
  await dialog.getByRole('button', { name: 'Lavender', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add life area', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.managed-area-main').filter({ hasText: 'Creativity' }).click();
  await expect(page.locator('.area-detail-banner')).toContainText('Make something just for you.');
  const refreshed = await getWorkspace();
  const creativity = refreshed.areas.find((area) => area.name === 'Creativity');
  const keptResponse = await context.request.post('/api/items/note', { data: { title: 'Keep this thought', areaId: creativity.id, data: { description: 'Safe when the area is removed.' } } });
  const kept = await keptResponse.json();
  await page.getByRole('button', { name: 'Delete Creativity', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, delete it', exact: true }).click();
  expect((await (await context.request.get(`/api/items/note/${kept.id}`)).json()).areaId).toBeNull();
  await context.request.delete(`/api/items/note/${kept.id}`);
  log('Life-area CRUD preserves related items when an area is removed');

  const email = `smoke-${Date.now()}@example.com`;
  const password = 'ezlife26Check2026!';
  const signup = await context.request.post('/api/auth', { data: { action: 'signup', name: 'Jamie Test', email, password } });
  expect(signup.status(), await signup.text()).toBe(200);
  const signedUp = await signup.json();
  expect(signedUp.user.id).toBe(workspace.user.id);
  expect(signedUp.user.isDemo).toBe(false);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.planner-tools').getByRole('button', { name: 'Settings', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your name', { exact: true }).fill('Jamie Morgan');
  await dialog.getByLabel(/^Your timezone/).selectOption('Europe/London');
  await dialog.getByLabel(/^A gentle daily check-in goal/).selectOption('5');
  await dialog.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await getWorkspace()).user.name).toBe('Jamie Morgan');
  expect((await getWorkspace()).user.dailyGoal).toBe(5);
  await page.locator('.planner-tools').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect((await context.request.get(`/api/items/target/${privateId}`)).status()).toBe(401);
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email address', { exact: true }).fill(email);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Sign in to ezlife26', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible();
  await expect(page.locator('.page-heading h1')).toContainText('Jamie');
  const badLogin = await context.request.post('/api/auth', { data: { action: 'signin', email, password: 'NotThePassword' } });
  expect(badLogin.status()).toBe(401);
  log('Sign-up preserves demo data; profile changes, sign-out, and sign-in persist');

  await page.keyboard.press('Control+k');
  await page.getByRole('searchbox', { name: 'Search your workspace', exact: true }).fill('grateful');
  await page.locator('.search-result').filter({ hasText: "A few things I'm grateful for" }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Edit your note' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  log('Global search and keyboard shortcut open the right resource');

  const mobile = await browser.newContext({ ...devices['iPhone 13'], baseURL });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', (error) => failures.push(error.message));
  await mobilePage.goto('/', { waitUntil: 'networkidle' });
  await expect(mobilePage.getByRole('heading', { name: 'Your day at a glance.' })).toBeVisible();
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mobilePage.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await mobilePage.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Files', exact: true }).click();
  await expect(mobilePage.getByRole('heading', { name: 'The important little things', exact: true })).toBeVisible();
  await mobilePage.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'Add anything', exact: true }).click();
  await mobilePage.getByRole('button', { name: /A daily habit Small steps/ }).click();
  dialog = mobilePage.getByRole('dialog');
  await dialog.getByLabel('Your daily habit', { exact: true }).fill('Pause and breathe');
  await dialog.getByLabel(/^Your daily goal/).fill('2 minutes');
  await dialog.getByRole('button', { name: 'Add habit', exact: true }).click();
  await expect(mobilePage.getByRole('dialog')).toHaveCount(0);
  await mobilePage.locator('.planner-tools').getByRole('button', { name: 'Habits & routines', exact: true }).click();
  await expect(mobilePage.getByRole('heading', { name: 'Pause and breathe', exact: true })).toBeVisible();
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mobilePage.setViewportSize({ width: 320, height: 780 });
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const manifest = await mobile.request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  await mobile.close();
  log('Mobile navigation, habit creation, responsive layout, and install manifest');

  expect(failures).toEqual([]);
  log('No browser runtime errors');
  console.log('\nAll ezlife26 smoke checks passed. Screenshots: artifacts/desktop.png, artifacts/mobile.png');
} catch (error) {
  await page.screenshot({ path: 'artifacts/failure.png', fullPage: true }).catch(() => {});
  console.error(error.message || String(error));
  if (failures.length) console.error('Browser errors:', failures);
  process.exitCode = 1;
} finally {
  await browser.close();
}
