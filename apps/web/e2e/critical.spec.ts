import { test, expect } from '@playwright/test';

const API = process.env.API_URL || 'http://127.0.0.1:4000';

test.describe('critical flows', () => {
  test('landing loads', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok() || res?.status() === 200).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('body')).toContainText(/criar|regist|conta/i);
  });

  test('login → dashboard (demo)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-?mail/i).fill('dpmanuel95@gmail.com');
    await page.getByLabel(/senha|password/i).fill('Manuel@121@');
    const tenant = page.getByLabel(/empresa|tenant|slug/i);
    if (await tenant.count()) await tenant.fill('demo');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL(/dashboard|whatsapp|inbox/, { timeout: 20_000 });
  });

  test('API health + metrics', async ({ request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok()).toBeTruthy();
    const metrics = await request.get(`${API}/metrics`);
    expect(metrics.ok()).toBeTruthy();
    const text = await metrics.text();
    expect(text).toContain('alurichat_');
  });
});
