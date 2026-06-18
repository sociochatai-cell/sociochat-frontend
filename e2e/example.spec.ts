import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\//);
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
});
