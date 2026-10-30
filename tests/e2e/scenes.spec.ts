import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\/(?!fonts\.(googleapis|gstatic)\.com)/, (route) => route.abort());
});

for (const width of [375, 1440]) test(`Live hub renders, animates, and pauses at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/');
  const hub = page.getByRole('region', { name: 'Team hub', exact: true });
  await hub.scrollIntoViewIfNeeded();
  await expect(hub.locator('canvas')).toBeVisible({ timeout: 20000 });
  const canvas = hub.locator('canvas');
  const first = await canvas.screenshot();
  await expect.poll(async () => !(await canvas.screenshot()).equals(first)).toBe(true);
  const resolution = await canvas.evaluate((node) => ({ pixels: (node as HTMLCanvasElement).width, css: node.getBoundingClientRect().width }));
  expect(resolution.pixels / resolution.css).toBeLessThanOrEqual(width < 640 ? 1.01 : 1.51);
  const timing = await page.evaluate(() => new Promise<{ averageFrameMs: number; maximumFrameMs: number }>((resolve) => {
    const gaps: number[] = []; let previous = performance.now();
    const sample = (now: number) => { gaps.push(now - previous); previous = now; if (gaps.length === 45) resolve({ averageFrameMs: gaps.reduce((total, gap) => total + gap, 0) / gaps.length, maximumFrameMs: Math.max(...gaps) }); else requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  }));
  await testInfo.attach('frame-sampling', { body: JSON.stringify(timing), contentType: 'application/json' });
  expect(timing.maximumFrameMs).toBeLessThan(1500);
  await page.screenshot({ path: `artifacts/screenshots/live-hub-${width}.png`, fullPage: false });
  await hub.getByRole('button', { name: 'Pause animation' }).click();
  await expect(canvas).toHaveCount(0);
  await expect(hub.locator('[data-scene-static]')).toBeVisible();
  await page.screenshot({ path: `artifacts/screenshots/live-hub-paused-${width}.png`, fullPage: false });
  await hub.getByRole('button', { name: 'Play animation' }).click();
  await expect(canvas).toBeVisible();
  await page.locator('main').getByRole('button', { name: 'Request time off', exact: true }).click();
  await expect(hub).toHaveAttribute('data-scene-active', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await hub.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true');
  await canvas.evaluate((node) => node.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(canvas).toHaveCount(0);
  await expect(hub.locator('[data-scene-static]')).toBeVisible();
});

test('Reduced motion and unavailable WebGL keep controls usable without loading Three.js', async ({ page }) => {
  const engines: string[] = [];
  page.on('request', (request) => { if (request.url().includes('SceneCanvas')) engines.push(request.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const hub = page.getByRole('region', { name: 'Team hub', exact: true });
  await hub.scrollIntoViewIfNeeded();
  await expect(hub.locator('[data-scene-static]')).toBeVisible();
  await expect(hub.locator('canvas')).toHaveCount(0);
  expect(engines).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null }));
  await page.reload();
  await expect(page.locator('main').getByRole('button', { name: 'Request time off', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('Login network is illustrative and a selected shift opens the animated calendar', async ({ page }) => {
  await page.goto('/?signedOut=1');
  await expect(page.getByText('An illustration of teamwork.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.goto('/?workspace=schedule&view=week&testRole=admin');
  const illustration = page.getByRole('region', { name: 'Shift selection', exact: true });
  await illustration.scrollIntoViewIfNeeded();
  await expect(illustration.locator('canvas')).toBeVisible({ timeout: 20000 });
  await page.locator('main').getByRole('button').filter({ hasText: /Alex Morgan/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const selected = page.getByRole('region', { name: 'Selected shift', exact: true });
  await expect(selected).toHaveAttribute('data-scene-state', 'selected');
  await expect(illustration).toHaveAttribute('data-scene-active', 'false');
});

test('Approval check appears only after a successful saved approval', async ({ page }) => {
  await page.goto('/?workspace=admin&view=approvals&testRole=admin');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Approval saved', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__shiftSyncTest.failNextWrite());
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Approval saved', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Approval saved', exact: true })).toBeVisible();
});

test('AI orb reflects the real request and response lifecycle', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/ai/troubleshoot', async (route) => { await gate; await route.fulfill({ contentType: 'text/event-stream', body: 'data: {"text":"[TIER: L1] [TEAM: Support]\\n### Quick Summary\\nCheck the network cable.\\n#### Step 1: Check connection\\nInspect the cable."}\n\ndata: [DONE]\n\n' }); });
  await page.goto('/?workspace=support&view=troubleshooter');
  const orb = page.getByRole('region', { name: 'AI support', exact: true });
  await expect(orb).toHaveAttribute('data-scene-state', 'idle');
  await page.locator('input').filter({ visible: true }).last().fill('Network cable disconnected');
  await page.getByRole('button', { name: 'Diagnose', exact: true }).click();
  await expect(orb).toHaveAttribute('data-scene-state', 'processing');
  release();
  await expect(orb).toHaveAttribute('data-scene-state', 'response');
});
