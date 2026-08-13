const { chromium } = require('playwright');
(async () => {
  const [, , url404, outPath] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`http://localhost:3100/${url404}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
})();
