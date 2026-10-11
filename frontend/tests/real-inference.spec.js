import { test, expect } from '@playwright/test';
test('real trained models, heatmap, model switching and history work together', async ({
  page,
  request,
}) => {
  const health = await (await request.get('/api/health')).json();
  test.skip(
    !health.available_models?.includes('vgg16') ||
      !health.available_models?.includes('cnn'),
    'Published model artifacts are optional in source-only CI.',
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  await page.locator('.sample').first().click();
  await page.getByRole('button', { name: 'Analyze this leaf' }).click();
  await expect(page.locator('.results h2')).toHaveText('Early blight', {
    timeout: 60000,
  });
  await expect(page.locator('.inference-meta')).toContainText('VGG16');
  await page
    .getByRole('checkbox', { name: 'Show model attention Grad-CAM' })
    .check();
  await expect(page.locator('.heat-overlay')).toBeVisible();
  await page.screenshot({
    path: '../docs/screenshots/real-diagnosis.png',
    fullPage: true,
  });
  await page
    .getByRole('combobox', { name: 'Analysis model' })
    .selectOption('cnn');
  await page.getByRole('button', { name: 'Analyze this leaf' }).click();
  await expect(page.locator('.inference-meta')).toContainText('CNN', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Model lab', exact: true }).click();
  await expect(page.locator('.metric-grid')).toBeVisible();
  await page.screenshot({
    path: '../docs/screenshots/model-lab.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
