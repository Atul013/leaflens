import { test, expect } from '@playwright/test';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);

test('desktop navigation, disease search and accessible guide', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A closer look. A healthier harvest.' }),
  ).toBeVisible();
  await expect(page.locator('.specimen-art img')).toHaveJSProperty(
    'naturalWidth',
    1200,
  );
  await page.screenshot({
    path: '../docs/screenshots/diagnose-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Disease atlas', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Search disease atlas' })
    .fill('early blight');
  await expect(page.locator('.disease-card')).toHaveCount(2);
  await page.locator('.disease-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Model lab', exact: true }).click();
  await expect(page.getByText('Athul M B · ASI23CA022')).toBeVisible();
  await page.getByRole('button', { name: 'Field notes', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Your first observation starts with a leaf.',
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('upload validation and service failure have useful recovery', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Upload leaf photo').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('wrong type'),
  });
  await expect(page.getByRole('alert')).toContainText('Choose a JPEG');
  await page
    .getByLabel('Upload leaf photo')
    .setInputFiles({ name: 'leaf.png', mimeType: 'image/png', buffer: png });
  await expect(
    page.getByRole('button', { name: 'Analyze this leaf' }),
  ).toBeVisible();
  await page.route('**/api/predict', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        detail:
          'No trained model is installed. Run the training pipeline, then try again.',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Analyze this leaf' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Run the training pipeline',
  );
  await expect(
    page.getByRole('button', { name: 'Analyze this leaf' }),
  ).toBeEnabled();
});

test('mobile layout and navigation fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A closer look. A healthier harvest.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '../docs/screenshots/diagnose-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Model lab', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Inside the model lab.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
