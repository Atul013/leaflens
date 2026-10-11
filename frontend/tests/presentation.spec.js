import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
test('presentation navigates all slides without overlapping the footer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const path = fileURLToPath(
    new URL('../../docs/PRESENTATION.html', import.meta.url),
  );
  await page.goto(pathToFileURL(path).href);
  await expect(page.locator('.slide.active')).toContainText('Atul Biju');
  const count = await page.locator('.slide').count();
  expect(count).toBe(12);
  for (let index = 0; index < count; index++) {
    const overflow = await page.locator('.slide.active').evaluate((slide) => {
      const footer = slide
        .querySelector('.slide-footer')
        .getBoundingClientRect();
      return [...slide.children]
        .filter((c) => !c.classList.contains('slide-footer'))
        .filter((c) => c.getBoundingClientRect().bottom > footer.top - 5)
        .map((c) => c.tagName);
    });
    expect(overflow, `slide ${index + 1} content overlaps footer`).toEqual([]);
    if (index === 0 || index === 6 || index === 11)
      await page.screenshot({
        path: `../docs/screenshots/presentation-${index + 1}.png`,
      });
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Home');
  await expect(page.locator('.slide.active')).toContainText('LeafLens');
});
