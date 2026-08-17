'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../db');
const { startServer, stopServer, DIRETORIA_TOKEN } = require('./helpers');
const { sessions } = require('../lib/sessions');

let server, baseUrl;
const createdIds = [];

const MARKETING_TOKEN = 'test-token-marketing-news';
const ESPORTES_TOKEN = 'test-token-esportes-news';

before(async () => {
  ({ server, baseUrl } = await startServer());
  sessions.set(MARKETING_TOKEN, { name: 'Marketing Teste', role: 'MARKETING', rank: 'DIRETOR', email: 'marketing-teste@compex.com.br', expiresAt: Date.now() + 60_000 });
  sessions.set(ESPORTES_TOKEN, { name: 'Esportes Teste', role: 'ESPORTES', rank: 'DIRETOR', email: 'esportes-teste@compex.com.br', expiresAt: Date.now() + 60_000 });
});

after(async () => {
  sessions.delete(MARKETING_TOKEN);
  sessions.delete(ESPORTES_TOKEN);
  for (const id of createdIds) {
    await prisma.news.delete({ where: { id } }).catch(() => {});
  }
  await stopServer(server);
});

test('POST /api/news sem permissão de conteúdo (ESPORTES) retorna 403', async () => {
  const res = await fetch(`${baseUrl}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ESPORTES_TOKEN}` },
    body: JSON.stringify({ title: 'Não autorizado', content: 'x', channels: ['HOME'] }),
  });
  assert.equal(res.status, 403);
});

test('POST /api/news sem autenticação retorna 401', async () => {
  const res = await fetch(`${baseUrl}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Anônimo', content: 'x', channels: ['HOME'] }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/news com MARKETING cria rascunho com slug único e status RASCUNHO', async () => {
  const res = await fetch(`${baseUrl}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ title: 'Notícia de Teste CMS', content: 'Conteúdo de teste.', channels: ['HOME', 'PORTAL'] }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  createdIds.push(data.id);
  assert.equal(data.status, 'RASCUNHO');
  assert.ok(data.slug.startsWith('noticia-de-teste-cms'));
  assert.deepEqual(data.channels, ['HOME', 'PORTAL']);
});

test('rascunho não aparece no endpoint público', async () => {
  const created = await prisma.news.create({
    data: { slug: `rascunho-oculto-${Date.now()}`, title: 'Rascunho oculto', category: 'Comunicado', content: 'x', authorName: 'Teste', channels: ['HOME'], status: 'RASCUNHO' },
  });
  createdIds.push(created.id);
  const res = await fetch(`${baseUrl}/api/public-news`);
  const data = await res.json();
  assert.ok(!data.some(item => item.id === created.id));
});

test('fluxo completo: rascunho -> publicar -> aparece no público -> arquivar -> some do público', async () => {
  const create = await fetch(`${baseUrl}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ title: 'Fluxo Completo CMS', content: 'Conteúdo do fluxo.', channels: ['HOME'] }),
  });
  const created = await create.json();
  createdIds.push(created.id);

  const publish = await fetch(`${baseUrl}/api/news`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ id: created.id, action: 'publish' }),
  });
  assert.equal(publish.status, 200);
  const published = await publish.json();
  assert.equal(published.status, 'PUBLICADO');

  const publicDetail = await fetch(`${baseUrl}/api/public-news/${created.slug}`);
  assert.equal(publicDetail.status, 200);

  const editAfterPublish = await fetch(`${baseUrl}/api/news`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ id: created.id, title: 'Tentativa de edição indevida' }),
  });
  assert.equal(editAfterPublish.status, 400);

  const archive = await fetch(`${baseUrl}/api/news`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ id: created.id, action: 'archive' }),
  });
  assert.equal(archive.status, 200);

  const publicDetailAfterArchive = await fetch(`${baseUrl}/api/public-news/${created.slug}`);
  assert.equal(publicDetailAfterArchive.status, 404);
});

test('DELETE /api/news só permite excluir rascunho ou arquivado', async () => {
  const create = await fetch(`${baseUrl}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ title: 'Para tentar excluir publicado', content: 'x', channels: ['HOME'] }),
  });
  const created = await create.json();
  createdIds.push(created.id);

  await fetch(`${baseUrl}/api/news`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MARKETING_TOKEN}` },
    body: JSON.stringify({ id: created.id, action: 'publish' }),
  });

  const deleteAttempt = await fetch(`${baseUrl}/api/news`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRETORIA_TOKEN}` },
    body: JSON.stringify({ id: created.id }),
  });
  assert.equal(deleteAttempt.status, 400);
});
