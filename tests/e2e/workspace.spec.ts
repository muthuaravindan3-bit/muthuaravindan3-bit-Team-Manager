import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // No test can contact a production database, sign-in service, or AI service.
  await context.route(/https:\/\/(?!fonts\.(googleapis|gstatic)\.com)/, (route) => route.abort());
});

test('Overview, old links, and browser Back', async ({ page }) => {
  await page.goto('/?workspace=needs_attention');
  await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Personal activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal activity', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible();
});

test('A failed leave save retains entries and retry creates one request', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Request time off', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await drawer.locator('textarea').fill('Family visit after my shift');
  await drawer.getByRole('button', { name: 'Review changes', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review changes' });
  await expect(review).toContainText('Family visit after my shift');
  await page.evaluate(() => window.__shiftSyncTest.failNextWrite());
  await review.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('Your entries are still here');
  await review.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your changes are saved' })).toBeVisible();
  expect(await page.evaluate(() => window.__shiftSyncTest.records('leaveRequests').filter((record) => record.reason === 'Family visit after my shift').length)).toBe(1);
});

test('Member cannot open admin controls through a direct URL', async ({ page }) => {
  await page.goto('/?workspace=admin');
  await expect(page.getByText('Only an admin can open this area.', { exact: false })).toBeVisible();
  await expect(page.getByText('Schedule Planner', { exact: true })).toHaveCount(0);
});

test('Admin assignment and time-off review change only the intended records', async ({ page }) => {
  await page.goto('/?workspace=admin&view=planner&testRole=admin');
  await page.getByLabel('Team Member', { exact: true }).selectOption('test-colleague');
  await page.getByLabel('Start Time', { exact: true }).fill('12:00');
  await page.getByLabel('End Time', { exact: true }).fill('20:00');
  await page.locator('form').getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review changes' })).toContainText('Jamie Lee');
  expect(await page.evaluate(() => window.__shiftSyncTest.records('shifts').length)).toBe(7);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review changes' })).toHaveCount(0);
  const created = await page.evaluate(() => window.__shiftSyncTest.records('shifts').find((record) => record.startTime === '12:00'));
  expect(created).toMatchObject({ userId: 'test-colleague', startTime: '12:00', endTime: '20:00' });
  await page.getByRole('button', { name: /Approvals Queue/ }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__shiftSyncTest.records('leaveRequests')[0].status)).toBe('approved');
  expect(await page.evaluate(() => window.__shiftSyncTest.records('shifts').length)).toBe(8);
});

test('Review dialogs contain focus and Escape returns to the form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Request time off', exact: true }).click();
  await page.getByLabel('Reason or Note for Manager').fill('Keyboard test');
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-labelledby'))).toBeTruthy();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Review changes' })).toHaveCount(0);
  await expect(page.getByLabel('Reason or Note for Manager')).toHaveValue('Keyboard test');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keep your changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Reason or Note for Manager')).toHaveValue('Keyboard test');
});

test('Find cover previews a reassignment before saving it', async ({ page }) => {
  await page.goto('/?testRole=admin');
  await page.getByRole('button', { name: 'View shift', exact: true }).click();
  await page.getByRole('button', { name: 'Choose person', exact: true }).click();
  await expect(page.getByLabel('Assigned Team Member', { exact: true })).toHaveValue('test-colleague');
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review changes' })).toContainText('Jamie Lee');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Your changes are saved.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__shiftSyncTest.records('shifts').find((record) => record.id === 'shift-0')?.userId)).toBe('test-colleague');
});

test('Incident creation and handover preserve the existing record contracts', async ({ page }) => {
  await page.goto('/?workspace=support&view=handover&testRole=admin');
  await page.getByRole('button', { name: 'Log Incident', exact: true }).click();
  const incident = page.getByRole('dialog', { name: 'Log shift incident' });
  await incident.locator('input').first().fill('Disposable incident for handover');
  await incident.locator('button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => window.__shiftSyncTest.records('incidentTickets').length)).toBe(2);
  await page.getByRole('button', { name: 'Complete Shift Sign-Off', exact: true }).click();
  const handover = page.getByRole('dialog', { name: 'Complete handover' });
  for (const checkbox of await handover.getByRole('checkbox').all()) await checkbox.check();
  await handover.locator('textarea').fill('Checks complete. Jamie will follow up.');
  await handover.locator('button[type="submit"]').click();
  await expect(page.getByRole('dialog', { name: 'Review changes' })).toContainText('Checks complete');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__shiftSyncTest.records('shiftHandovers').length)).toBe(1);
  expect(await page.evaluate(() => window.__shiftSyncTest.records('shiftHandovers')[0])).toMatchObject({ leadEngineerId: 'test-member', openIncidentsCount: 2, notes: 'Checks complete. Jamie will follow up.' });
});

test('Routine incoming changes wait for review', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your next shift' })).toBeVisible();
  await page.evaluate(() => window.__shiftSyncTest.insert('leaveRequests/incoming', { userId: 'test-member', userName: 'Alex Morgan', startDate: '2026-12-01', endDate: '2026-12-02', status: 'pending', createdAt: Date.now() }));
  await expect(page.getByRole('button', { name: 'Review updates', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review updates', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review updates', exact: true })).toHaveCount(0);
});

test('Saved views persist and shift details support browser Back', async ({ page }) => {
  await page.goto('/?workspace=schedule&view=week');
  await page.getByRole('button', { name: 'Night shifts', exact: true }).click();
  await page.getByRole('button', { name: 'Save current view', exact: true }).click();
  await page.getByLabel('View name', { exact: true }).fill('Night coverage');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Night coverage', exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await page.goto('/?workspace=dashboard&view=summary');
  await page.getByRole('button', { name: 'View shift', exact: true }).click();
  await expect(page).toHaveURL(/shift=shift-0/);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('A reviewed swap updates the request and assignment together through existing operations', async ({ page }) => {
  await page.goto('/?workspace=requests&view=swaps&testRole=admin');
  await page.evaluate(() => {
    const original = window.__shiftSyncTest.records('shiftSwaps')[0];
    window.__shiftSyncTest.insert('shiftSwaps/swap-1', { ...original, status: 'accepted', targetUserId: 'test-member' });
  });
  await page.getByRole('button', { name: /Approve/, exact: false }).filter({ hasText: 'Approve' }).first().click();
  await page.getByRole('dialog', { name: 'Review changes' }).getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => page.evaluate(() => window.__shiftSyncTest.records('shiftSwaps')[0].status)).toBe('approved');
  expect(await page.evaluate(() => window.__shiftSyncTest.records('shifts').find((record) => record.id === 'shift-1')?.userId)).toBe('test-member');
});

for (const width of [375, 390, 1024, 1440, 1920]) for (const theme of ['light', 'dark']) {
  test(`All page areas at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((mode) => localStorage.setItem('shiftsync_theme_slate_v1', `warm-obsidian-${mode}`), theme);
    for (const [workspace, view] of [['dashboard', 'summary'], ['dashboard', 'attention'], ['dashboard', 'activity'], ['schedule', 'week'], ['schedule', 'list'], ['schedule', 'mine'], ['requests', 'swaps'], ['requests', 'leaves'], ['operations', 'directory'], ['operations', 'tracker'], ['operations', 'breaks'], ['operations', 'handover'], ['support', 'chat'], ['support', 'handover'], ['support', 'troubleshooter'], ['admin', 'planner'], ['admin', 'approvals'], ['admin', 'team'], ['admin', 'settings']]) {
      await page.goto(`/?workspace=${workspace}&view=${view}&testRole=admin`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByRole('status', { name: 'Loading content', exact: true })).toHaveCount(0);
      await expect(page.getByText('Something interrupted the workspace')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${workspace}/${view} overflow`).toBe(true);
      await expect(page.locator('main [style*="opacity: 0"]')).toHaveCount(0);
      if (workspace === 'dashboard' && view === 'summary') await page.screenshot({ path: `artifacts/screenshots/overview-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      if ((width === 1440 && theme === 'light' || width === 390 && theme === 'dark') && ['week', 'leaves', 'directory', 'handover', 'planner'].includes(view)) await page.screenshot({ path: `artifacts/screenshots/${workspace}-${view}-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    }
  });
}


test('A pending profile metadata write does not block startup', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('test-startup-hang', 'write'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your next shift' })).toBeVisible({ timeout: 5000 });
});

test('A stalled profile read times out and Try again recovers', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('test-startup-hang', 'read'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Workspace connection paused' })).toBeVisible({ timeout: 16000 });
  await expect(page.getByText('Loading ShiftSync workspace...')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem('test-startup-hang'));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next shift' })).toBeVisible();
});


test('Dimensional controls remain keyboard accessible with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Request time off', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Request time off', exact: true })).toBeFocused();
  const styles = await page.getByRole('button', { name: 'Request time off', exact: true }).evaluate((node) => ({ transition: getComputedStyle(node).transitionDuration, outline: getComputedStyle(node).outlineStyle, height: node.getBoundingClientRect().height }));
  expect(styles.transition).toBe('0s');
  expect(styles.outline).not.toBe('none');
  expect(styles.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('Staff cards show recorded workload at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/?workspace=operations&view=directory');
  const cards = page.getByRole('region', { name: 'Team availability' });
  await expect(cards.getByRole('heading', { name: 'Alex Morgan' })).toBeVisible();
  await expect(cards.getByText(/scheduled assignments/)).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'artifacts/screenshots/team-3d-375.png', fullPage: true, animations: 'disabled' });
});
