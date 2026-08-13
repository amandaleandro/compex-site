'use strict';

const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');

let server, baseUrl;
const createdFiles = [];

// Menor PNG válido possível (1x1 pixel transparente), como Buffer.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

before(async () => {
  ({ server, baseUrl } = await startServer());
});

after(async () => {
  // Remove os arquivos físicos gerados pelos testes de upload para manter a suíte repetível.
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  for (const relativeUrl of createdFiles) {
    const filePath = path.join(uploadsDir, relativeUrl.replace(/^\/uploads\//, ''));
    fs.rm(filePath, { force: true }, () => {});
  }
  await stopServer(server);
});

test('POST /api/news/upload com imagem válida e auth retorna 200 + url em /uploads/news/', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(TINY_PNG_BASE64, 'base64')], { type: 'image/png' }), 'tiny.png');
  const res = await fetch(`${baseUrl}/api/news/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: form,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.url, /^\/uploads\/news\//);
  createdFiles.push(data.url);
});

test('POST /api/products/upload com imagem válida e auth retorna 200 + url em /uploads/products/', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(TINY_PNG_BASE64, 'base64')], { type: 'image/png' }), 'tiny.png');
  const res = await fetch(`${baseUrl}/api/products/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: form,
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.url, /^\/uploads\/products\//);
  createdFiles.push(data.url);
});

test('POST /api/news/upload com mimetype não permitido retorna 400', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('conteudo texto')], { type: 'text/plain' }), 'arquivo.txt');
  const res = await fetch(`${baseUrl}/api/news/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: form,
  });
  assert.equal(res.status, 400);
});

test('GET /api/products (rota do associado) continua funcionando e não é capturada pelo carve-out de /api/products/upload', async () => {
  const res = await fetch(`${baseUrl}/api/products`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(await res.json()));
});
