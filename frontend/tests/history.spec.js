import { test, expect } from '@playwright/test';

const fixture = {
  predictions: [
    {
      id: 'Tomato___healthy',
      crop: 'Tomato',
      condition: 'Healthy',
      healthy: true,
      symptoms: 'An illustrative API response for testing storage.',
      guidance: [],
      probability: 0.9,
    },
  ],
  heatmap:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  architecture: 'cnn',
  confidence: 0.9,
  uncertain: false,
  threshold: 0.7,
  elapsed_ms: 100,
  created_at: '2026-10-11T00:00:00Z',
  model_epoch: 1,
  manifest_hash: 'test-only',
  notice: 'Test fixture',
};
async function analyzeFixture(page) {
  await page.route('**/api/predict', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    }),
  );
  await page
    .getByLabel('Upload leaf photo')
    .setInputFiles('public/botanical.jpg');
  await page.getByRole('button', { name: 'Analyze this leaf' }).click();
  await expect(page.locator('.results h2')).toHaveText('Healthy');
}
test('field notes persist compact metadata and recover from malformed storage', async ({
  page,
}) => {
  await page.goto('/');
  await analyzeFixture(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('leaflens-history') || '[]').length,
      ),
    )
    .toBe(1);
  const entry = await page.evaluate(
    () => JSON.parse(localStorage.getItem('leaflens-history'))[0],
  );
  expect(entry.heatmap).toBeUndefined();
  expect(entry.thumbnail).toMatch(/^data:image\/jpeg/);
  await page.reload();
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  await page.evaluate(() => localStorage.setItem('leaflens-history', 'null'));
  await page.reload();
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Your first observation starts with a leaf.',
    }),
  ).toBeVisible();
});
test('storage quota errors are visible and do not lose the current prediction', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await analyzeFixture(page);
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await expect(
    page.getByRole('button', { name: 'Save analysis' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  await page.getByRole('button', { name: 'Delete saved analysis' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
});
