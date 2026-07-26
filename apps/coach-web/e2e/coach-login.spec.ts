import { test, expect } from '@playwright/test';

const base = process.env.COACH_WEB_URL ?? 'http://127.0.0.1:3000';

test('coach login shell', async ({ page }) => {
  await page.goto(base);
  await expect(page.getByText('23PrimeFit', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Coach every athlete with complete context/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign in to workspace/i })).toBeVisible();
});
