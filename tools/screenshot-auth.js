const { chromium } = require('playwright');
(async () => {
  const [, , page404, outPath] = process.argv;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1100 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3100/public/login.html');
  await page.evaluate(() => sessionStorage.setItem('compex-token', 'demo-session-associado'));
  await page.goto(`http://localhost:3100/${page404}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
})();
