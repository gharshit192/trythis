// @ts-check
import { test, expect } from '@playwright/test';

async function openApp(page) {
  await page.goto('/');
  await expect(page.locator('.bnav')).toBeVisible({ timeout: 15000 });
}

async function navBox(page) {
  return await page.locator('.bnav').boundingBox();
}

test('main shell renders with a stable footer', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.hdr-title')).toContainText('What are you');
  await expect(page.locator('.bnav')).toBeVisible();
  await expect(page.locator('.nav-add-btn')).toBeVisible();
});

test('bottom nav keeps a stable dock across tabs', async ({ page }) => {
  await openApp(page);
  const homeBox = await navBox(page);
  expect(homeBox).toBeTruthy();

  await page.locator('.bnav').getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByText('My collections')).toBeVisible({ timeout: 10000 });
  const savedBox = await navBox(page);

  await page.locator('.bnav').getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByText('Search')).toBeVisible({ timeout: 10000 });
  const exploreBox = await navBox(page);

  await page.locator('.bnav').getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('.prof-name')).toContainText('Profile', { timeout: 10000 });
  const profileBox = await navBox(page);

  for (const box of [savedBox, exploreBox, profileBox]) {
    expect(box).toBeTruthy();
    expect(Math.abs(box.y - homeBox.y)).toBeLessThanOrEqual(12);
    expect(Math.abs(box.height - homeBox.height)).toBeLessThanOrEqual(4);
  }
});

test('add-save entry is available from the footer and opens both modes', async ({ page }) => {
  await openApp(page);
  await page.locator('.bnav').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Add a save')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.chips').getByRole('button', { name: 'Link', exact: true })).toBeVisible();
  await expect(page.locator('.chips').getByRole('button', { name: 'Photos', exact: true })).toBeVisible();
  await page.locator('.chips').getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.getByText('Tap to add photos')).toBeVisible();
});
