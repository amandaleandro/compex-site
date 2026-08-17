'use strict';

const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');

let server, baseUrl;
let filename, filePath, documentId;

before(async () => {
  ({ server, baseUrl } = await startServer());
  filename = `private_${Date.now()}.txt`;
  filePath = path.join(__dirname, '..', 'uploads', filename);
  fs.writeFileSync(filePath, 'conteudo restrito');
  const document = await prisma.document.create({
    data: { name: 'Documento de teste', category: 'Teste', url: `/uploads/${filename}`, isPublic: false },
  });
  documentId = document.id;
});

after(async () => {
  await prisma.document.delete({ where: { id: documentId } }).catch(() => {});
  fs.rm(filePath, { force: true }, () => {});
  await stopServer(server);
});

test('GET /uploads/<documento privado> sem autenticação retorna 403 (não 500)', async () => {
  const res = await fetch(`${baseUrl}/uploads/${filename}`);
  assert.equal(res.status, 403);
});

test('GET /uploads/<documento privado> com sessão de diretoria retorna 200', async () => {
  const res = await fetch(`${baseUrl}/uploads/${filename}`, {
    headers: { Authorization: `Bearer ${DIRETORIA_TOKEN}` },
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.equal(text, 'conteudo restrito');
});
