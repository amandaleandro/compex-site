const fs = require('fs');
const { PNG } = require('pngjs');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('Uso: node clean-logo-background.js entrada.png saida.png');

const png = PNG.sync.read(fs.readFileSync(input));
const { width, height, data } = png;
const visited = new Uint8Array(width * height);
const queue = [];
const isCheckerPixel = (x, y) => {
  const i = (y * width + x) * 4;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return data[i + 3] > 0 && spread < 18 && r >= 220 && g >= 220 && b >= 220;
};
const add = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (!visited[p] && isCheckerPixel(x, y)) { visited[p] = 1; queue.push(p); }
};

for (let x = 0; x < width; x++) { add(x, 0); add(x, height - 1); }
for (let y = 0; y < height; y++) { add(0, y); add(width - 1, y); }
for (let cursor = 0; cursor < queue.length; cursor++) {
  const p = queue[cursor], x = p % width, y = Math.floor(p / width);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) add(x + dx, y + dy);
}
for (let p = 0; p < visited.length; p++) if (visited[p]) data[p * 4 + 3] = 0;
fs.writeFileSync(output, PNG.sync.write(png));
console.log(`Fundo removido: ${queue.length} pixels; ${width}x${height}`);
