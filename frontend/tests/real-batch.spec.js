import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

test('five real photos work with both trained models on desktop and mobile', async ({
  page,
  request,
}) => {
  test.setTimeout(240000);
  const health = await (await request.get('/api/health')).json();
  test.skip(
    !health.available_models?.includes('vgg16') ||
      !health.available_models?.includes('cnn'),
    'Trained checkpoints are optional in source-only CI.',
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  const files = await Promise.all(
    [1, 2, 3, 4, 1].map(async (n, i) => ({
      name: `crop-leaf-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await readFile(`public/samples/specimen-${n}.jpg`),
    })),
  );
  await page
    .getByLabel('Upload leaf photo', { exact: true })
    .setInputFiles(files);
  await page
    .getByRole('button', { name: 'Analyze 5 photos', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('5 of 5 analyzed', {
    timeout: 150000,
  });
  await expect(page.locator('.comparison-row')).toHaveCount(5);
  await expect(page.locator('.specimen-tab.done')).toHaveCount(5);
  await expect(page.locator('.inference-meta')).toContainText('VGG16');
  await page
    .getByRole('checkbox', { name: 'Show model attention Grad-CAM' })
    .check();
  await expect(page.locator('.heat-overlay')).toHaveJSProperty(
    'naturalWidth',
    256,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '../docs/screenshots/batch-real-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  const desktopAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    desktopAudit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page
    .getByRole('combobox', { name: 'Analysis model' })
    .selectOption('cnn');
  await page
    .getByRole('button', { name: 'Analyze 5 photos', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('5 of 5 analyzed', {
    timeout: 150000,
  });
  await expect(page.locator('.specimen-tab.done')).toHaveCount(5);
  await expect(page.locator('.inference-meta')).toContainText('CNN');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Your batch at a glance' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Inspect crop-leaf-3.jpg', exact: true })
    .click();
  await expect(
    page.locator('.specimen-select[aria-pressed="true"]'),
  ).toContainText('crop-leaf-3.jpg');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '../docs/screenshots/batch-real-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  const mobileAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    mobileAudit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('leaflens-history')).length,
    ),
  ).toBe(10);
  expect(errors).toEqual([]);
});
