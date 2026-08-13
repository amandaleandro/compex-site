// Uso: node tools/screenshot.js <caminho.html> [saida.png] [largura] [altura]
// Ex.: node tools/screenshot.js login.html shots/login.png 1440 900
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

async function main() {
  const [, , page404, outArg, wArg, hArg] = process.argv;
  if (!page404) {
    console.error('Uso: node tools/screenshot.js <arquivo.html> [saida.png] [largura] [altura]');
    process.exit(1);
  }
  const width = Number(wArg) || 1440;
  const height = Number(hArg) || 900;
  const outPath = outArg || path.join('tools', 'shots', page404.replace(/\.html$/, '') + '.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Aponta para o servidor real (npm start / backend/server.js), que injeta CSS/JS
  // extra por nome de página (ver backend/server.js linha ~100). Um servidor estático
  // simples NÃO reproduz isso — nunca use um para validar mudanças visuais aqui.
  const baseUrl = process.env.COMPEX_BASE_URL || 'http://localhost:3100';
  const url = `${baseUrl}/${page404.replace(/^\/+/, '')}`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(`Screenshot salvo em ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
