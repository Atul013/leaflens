import { test, expect } from '@playwright/test';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const photo = (n) => ({
  name: `leaf-${n}.png`,
  mimeType: 'image/png',
  buffer: png,
});
function prediction(healthy = false) {
  const top = {
    id: healthy ? 'healthy' : 'early',
    crop: 'Tomato',
    condition: healthy ? 'Healthy' : 'Early blight',
    healthy,
    symptoms: 'Observe the leaf pattern in natural light.',
    guidance: [
      'Inspect nearby leaves.',
      'Confirm with an agricultural expert.',
    ],
    probability: 0.82,
  };
  return {
    architecture: 'vgg16',
    confidence: 0.82,
    uncertain: false,
    elapsed_ms: 120,
    heatmap: `data:image/png;base64,${png.toString('base64')}`,
    predictions: [
      top,
      { ...top, id: 'late', condition: 'Late blight', probability: 0.12 },
    ],
  };
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', (r) =>
    r.fulfill({
      json: {
        model_ready: true,
        architecture: 'vgg16',
        available_models: ['cnn', 'vgg16'],
        max_upload_mb: 4,
      },
    }),
  );
});
test('five photos produce a comparison, individual details, attention and a complete export', async ({
  page,
}) => {
  let count = 0;
  await page.route('**/api/predict', (r) =>
    r.fulfill({ json: prediction(count++ === 0) }),
  );
  await page.goto('/');
  await page
    .getByLabel('Upload leaf photo', { exact: true })
    .setInputFiles([1, 2, 3, 4, 5].map(photo));
  await expect(page.locator('.specimen-tab')).toHaveCount(5);
  await page
    .getByRole('button', { name: 'Analyze 5 photos', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your batch at a glance' }),
  ).toBeVisible();
  await expect(page.locator('.comparison-row')).toHaveCount(5);
  await expect(page.getByRole('status')).toContainText('5 of 5 analyzed');
  expect(count).toBe(5);
  await page.getByRole('button', { name: /Inspect leaf-2.png/ }).click();
  await expect(page.locator('.results h2')).toHaveText('Early blight');
  await expect(
    page.getByRole('button', {
      name: /View analysis for leaf-2.png.*Early blight.*82.0%/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Early blight');
  await page
    .getByRole('checkbox', { name: 'Show model attention Grad-CAM' })
    .check();
  await expect(page.locator('.heat-overlay')).toBeVisible();
  await expect(
    page.getByText('Inspect nearby leaves.', { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download batch report' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('leaflens-batch-analysis.json');
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report.images).toHaveLength(5);
  expect(report.summary.completed).toBe(5);
  expect(report.summary.healthy).toBe(1);
  expect(report.images[1].result.predictions[0].condition).toBe('Early blight');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/batch-mock-desktop.png',
    fullPage: true,
  });
});

test('mixed valid and invalid uploads keep valid photos and enforce the per-photo size limit', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Upload leaf photo', { exact: true }).setInputFiles([
    photo(1),
    {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('notes'),
    },
    photo(2),
  ]);
  await expect(page.locator('.specimen-tab')).toHaveCount(2);
  await expect(page.getByRole('alert')).toContainText(
    'notes.txt was not added',
  );
  await page.getByLabel('Upload leaf photo', { exact: true }).setInputFiles({
    name: 'large.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toContainText('exceeds 4 MB');
  await expect(page.locator('.specimen-tab')).toHaveCount(2);
});

test('stopping a batch keeps completed results and navigation preserves the selection', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/predict', async (r) => {
    requests++;
    if (requests === 2)
      await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await r.fulfill({ json: prediction() });
    } catch {
      /* The stopped request is aborted. */
    }
  });
  await page.goto('/');
  await page
    .getByLabel('Upload leaf photo', { exact: true })
    .setInputFiles([1, 2, 3].map(photo));
  await page
    .getByRole('button', { name: 'Analyze 3 photos', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('1 of 3 analyzed');
  await page.getByRole('button', { name: 'Stop analysis' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Completed results are kept',
  );
  await page
    .getByRole('button', { name: 'Disease atlas', exact: true })
    .click();
  await page.getByRole('button', { name: 'Diagnose', exact: true }).click();
  await expect(page.locator('.specimen-tab')).toHaveCount(3);
  await expect(page.getByRole('status')).toContainText('1 of 3 analyzed');
  await page
    .getByRole('button', { name: 'Analyze 2 photos', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('3 of 3 analyzed');
  expect(requests).toBe(4);
});
test('limit, append, removal and clear keep selection understandable on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByLabel('Upload leaf photo', { exact: true })
    .setInputFiles([1, 2, 3, 4, 5, 6].map(photo));
  await expect(page.locator('.specimen-tab')).toHaveCount(5);
  await expect(page.getByRole('alert')).toContainText('5 photos');
  await page
    .getByRole('button', { name: 'Remove leaf-3.png', exact: true })
    .click();
  await expect(page.locator('.specimen-tab')).toHaveCount(4);
  await page
    .getByLabel('Upload leaf photo', { exact: true })
    .setInputFiles(photo(6));
  await expect(page.locator('.specimen-tab')).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Clear photos' }).click();
  await expect(page.locator('.specimen-tab')).toHaveCount(0);
});
test('partial failures preserve results, retry only failed images and model changes invalidate results', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/predict', (r) => {
    requests++;
    return requests === 2
      ? r.fulfill({
          status: 503,
          json: { detail: 'Image service interrupted. Try again.' },
        })
      : r.fulfill({ json: prediction() });
  });
  await page.goto('/');
  await page
    .getByLabel('Upload leaf photo', { exact: true })
    .setInputFiles([1, 2, 3].map(photo));
  await page
    .getByRole('button', { name: 'Analyze 3 photos', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retry 1 photo', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.comparison-row')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Retry 1 photo', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('3 of 3 analyzed');
  expect(requests).toBe(4);
  await page
    .getByRole('combobox', { name: 'Analysis model' })
    .selectOption('cnn');
  await expect(page.locator('.comparison-row')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Analyze 3 photos', exact: true }),
  ).toBeEnabled();
});
