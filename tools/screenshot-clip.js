const { chromium } = require('playwright');
(async () => {
  const [, , page404, outPath, x, y, w, h] = process.argv;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto(`http://localhost:3100/${page404}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, clip: { x: Number(x), y: Number(y), width: Number(w), height: Number(h) } });
  await browser.close();
})();
